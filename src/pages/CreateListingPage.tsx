// ============================================================================
//  CreateListingPage — Avito uslubidagi 4 qadamli wizard konteyneri.
//  Bitta react-hook-form ombori (FormProvider) barcha maydonlarni qadamlar
//  bo'ylab saqlaydi; zodResolver inline validatsiya qiladi. Bu fayl reference
//  ma'lumot (katalog/kategoriya/lokatsiya/attrSchema), AI yordam, media upload,
//  GPS va monetization logikasini ushlab, ularni WizardController context orqali
//  qadam komponentlariga beradi. Edit-mode prefill, AI badge/qizil eslatma va
//  submit-dagi AI tavsif to'liq saqlangan.
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, FormProvider, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type {
  ListingType,
  Category,
  Region,
  District,
  Organization,
  Catalog,
  CategoryAttribute,
} from '../types/index.ts';
import type { WizardFormValues, JobPostingPayload } from '../types/wizard.ts';
import {
  apiRequest,
  uploadImageFile,
  uploadVideoFile,
  getPublicMonetization,
  getPublicSecurity,
  getCatalogs,
  getCategoryAttributes,
  aiPrefillAttributes,
  aiGenerateDescription,
  type PublicMonetization,
} from '../lib/api.ts';
import { makeListingSchema } from '../lib/listingSchema.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useI18n } from '../i18n/IntlContext.tsx';
import { TYPE_META } from '../components/listing-wizard/wizardMeta.ts';
import {
  WizardControllerProvider,
  type WizardController,
  type AiSuggestion,
} from '../components/listing-wizard/wizardContext.tsx';
import StepWizard from '../components/listing-wizard/StepWizard.tsx';

interface CreateListingPageProps {
  onNavigate: (route: string) => void;
  onCreated: (listingId: string) => void;
  editListingId?: string;
}

// Bo'sz forma holati (yangi e'lon). region/district/lat-lon foydalanuvchidan.
const makeDefaults = (user: any): WizardFormValues => ({
  catalogId: '', type: '', title: '', categoryId: '',
  attributes: {}, skills: [], customDescription: '',
  priceType: 'FIXED', priceMin: '', priceMax: '',
  salaryType: 'SALARY_FIXED', salaryMin: '', salaryMax: '',
  workFormat: 'ONSITE', experienceLevel: '1-3',
  regionId: user?.region_id || '', districtId: user?.district_id || '',
  latitude: user?.latitude, longitude: user?.longitude,
  contactTime: 'ANY_TIME', contactCustomText: '', organizationId: '',
  images: [], videos: [],
});

export const CreateListingPage: React.FC<CreateListingPageProps> = ({ onNavigate, onCreated, editListingId }) => {
  const { user } = useAuth();
  const { t, localized, intlLocale } = useI18n();
  const isEditing = !!editListingId;

  // ── Reference data ──
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [userOrgs, setUserOrgs] = useState<Organization[]>([]);
  const [attrSchema, setAttrSchema] = useState<CategoryAttribute[]>([]);
  const [monetization, setMonetization] = useState<PublicMonetization | null>(null);

  // ── UI / submission ──
  const [isLoadingEdit, setIsLoadingEdit] = useState(!!editListingId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  // ── Qoralama (DRAFT) + bot-himoya (captcha) ──
  const [captchaSitekey, setCaptchaSitekey] = useState<string | null>(null);
  const [isDraftEditing, setIsDraftEditing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<number | null>(null);
  const captchaTokenRef = useRef<string>('');
  // Saqlangan qoralama id'si — keyincha PUT bilan yangilanadi (takror POST bo'lmaydi).
  const draftIdRef = useRef<string | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── AI state ──
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiFilledKeys, setAiFilledKeys] = useState<string[]>([]);
  const [isAttrPrefilling, setIsAttrPrefilling] = useState(false);
  const [attrPrefillReason, setAttrPrefillReason] = useState('');
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const prefillSignatureRef = useRef('');

  // ── Dinamik zod resolver: sxema isJobs/showEmployment/attrSchema/t ga bog'liq.
  //    Ref orqali har doim eng yangi resolver ishlatiladi (useForm bir marta oladi).
  const resolverRef = useRef<any>(zodResolver(makeListingSchema({ isJobs: false, showEmployment: false, attrSchema: [], t })));
  const stableResolver = useCallback<Resolver<WizardFormValues>>(
    (values, ctx, opts) => resolverRef.current(values, ctx, opts),
    []
  );

  const methods = useForm<WizardFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: stableResolver as any,
    mode: 'onTouched',
    defaultValues: makeDefaults(user),
  });
  const { watch, setValue, getValues, reset } = methods;

  // ── Watch (form fields) ──
  const catalogId = watch('catalogId');
  const type = watch('type');
  const categoryId = watch('categoryId');
  const title = watch('title');
  const regionId = watch('regionId');

  // ── Derived ──
  const isJobs = catalogId === 'jobs';
  const isServices = catalogId === 'services';
  const showEmployment = isJobs || isServices;

  const selectedCategoryObj = useMemo(() => categories.find((c) => c.id === categoryId), [categories, categoryId]);
  const parentCategoryId = selectedCategoryObj?.parent_id || categoryId;
  const parentCategoryObj = useMemo(() => categories.find((c) => c.id === parentCategoryId), [categories, parentCategoryId]);
  const isLeafSelected = !!selectedCategoryObj?.parent_id;
  const parentCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const subcategoriesOfParent = useMemo(
    () => categories.filter((c) => c.parent_id === parentCategoryId),
    [categories, parentCategoryId]
  );

  // ── Resolver sxemani yangilaydi ──
  useEffect(() => {
    resolverRef.current = zodResolver(makeListingSchema({ isJobs, showEmployment, attrSchema, t }));
  }, [isJobs, showEmployment, attrSchema, t]);

  // ── Load catalogs + regions + orgs + monetization once ──
  useEffect(() => {
    getCatalogs().then(setCatalogs).catch(() => setCatalogs([]));
    apiRequest<Region[]>('/api/locations/regions').then(setRegions).catch(console.error);
    apiRequest<Organization[]>('/api/organizations/my/list').then(setUserOrgs).catch(console.error);
    getPublicMonetization().then(setMonetization).catch(() => {});
    getPublicSecurity().then((s) => setCaptchaSitekey(s?.turnstile_sitekey ?? null)).catch(() => setCaptchaSitekey(null));
  }, []);

  // ── Categories depend on catalog + (jobs) scope ──
  useEffect(() => {
    if (!catalogId) {
      setCategories([]);
      return;
    }
    const qs = new URLSearchParams({ catalog_id: catalogId });
    if (catalogId === 'jobs' && type) qs.set('scope', type);
    apiRequest<Category[]>(`/api/categories?${qs.toString()}`)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [catalogId, type]);

  // ── Attribute schema depends on category ──
  useEffect(() => {
    if (!categoryId) {
      setAttrSchema([]);
      return;
    }
    setAiFilledKeys([]);
    setAttrPrefillReason('');
    prefillSignatureRef.current = '';
    getCategoryAttributes(categoryId)
      .then(setAttrSchema)
      .catch(() => setAttrSchema([]));
  }, [categoryId]);

  // ── Districts on region change ──
  useEffect(() => {
    if (!regionId) {
      setDistricts([]);
      return;
    }
    apiRequest<District[]>(`/api/locations/districts?region_id=${regionId}`)
      .then(setDistricts)
      .catch(console.error);
  }, [regionId]);

  // ── Edit mode: prefill (butun holatni RHF omboriga reset qiladi) ──
  useEffect(() => {
    if (!editListingId) return;
    (async () => {
      try {
        const l = await apiRequest<any>(`/api/listings/${editListingId}`);
        if (!l) return;
        // Qoralama sifatida ochilgan bo'lsa — keyincha "joylash" oqimi ishlaydi.
        if (l.status === 'DRAFT') { setIsDraftEditing(true); draftIdRef.current = l.id; }
        const skillsArr: string[] = Array.isArray(l.skills) ? l.skills : (() => { try { return JSON.parse(l.skills || '[]'); } catch { return []; } })();
        const attrs = typeof l.attributes === 'string' ? JSON.parse(l.attributes || '{}') : (l.attributes || {});
        const media: string[] = Array.isArray(l.images) ? l.images : [];
        const isVid = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);
        reset({
          catalogId: l.catalog_id || '',
          type: l.type || 'SERVICE_OFFER',
          title: l.title || '',
          categoryId: l.category_id || '',
          attributes: attrs,
          skills: skillsArr,
          customDescription: l.description || '',
          priceType: l.price_type || 'FIXED',
          priceMin: l.price_min != null ? String(l.price_min) : '',
          priceMax: l.price_max != null ? String(l.price_max) : '',
          salaryType: l.salary_type || 'SALARY_FIXED',
          salaryMin: l.salary_min != null ? String(l.salary_min) : '',
          salaryMax: l.salary_max != null ? String(l.salary_max) : '',
          workFormat: l.work_format || 'ONSITE',
          experienceLevel: l.experience_level || '1-3',
          regionId: l.region_id || '',
          districtId: l.district_id || '',
          latitude: l.latitude != null ? l.latitude : undefined,
          longitude: l.longitude != null ? l.longitude : undefined,
          contactTime: l.contact_time || 'ANY_TIME',
          contactCustomText: l.contact_custom_text || '',
          organizationId: l.organization_id || '',
          images: media.filter((u) => !isVid(u)),
          videos: media.filter((u) => isVid(u)),
        });
      } catch (err) {
        console.error('Edit listing load error:', err);
        setSubmitError(t('create.errLoadEdit'));
      } finally {
        setIsLoadingEdit(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editListingId, catalogs]);

  // ── Handlers: workflow selections ──
  const chooseCatalog = useCallback((cat: Catalog) => {
    setValue('catalogId', cat.id);
    setValue('categoryId', '');
    setValue('attributes', {});
    setAiSuggestion(null);
    const types = (cat.listing_types || '').split(',').map((x) => x.trim()).filter((x) => !!TYPE_META[x as ListingType]);
    setValue('type', types.length === 1 ? (types[0] as ListingType) : '');
  }, [setValue]);

  const chooseType = useCallback((tp: ListingType) => {
    setValue('type', tp);
    setValue('attributes', {});
    if (getValues('catalogId') === 'jobs') setValue('categoryId', '');
  }, [setValue, getValues]);

  const selectCategory = useCallback((id: string) => {
    setValue('categoryId', id);
    setValue('attributes', {});
  }, [setValue]);

  const handleToggleFeature = useCallback((feat: string) => {
    const cur = getValues('skills') || [];
    setValue('skills', cur.includes(feat) ? cur.filter((f) => f !== feat) : [...cur, feat]);
  }, [getValues, setValue]);

  // ── AI: kategoriya tavsiyasi ──
  const requestAiSuggestion = useCallback(async (searchTitle?: string) => {
    const text = (searchTitle !== undefined ? searchTitle : getValues('title')).trim();
    if (!text || text.length < 3) return;
    setIsAiLoading(true);
    try {
      const res = await apiRequest<AiSuggestion>('/api/ai/suggest-category', {
        method: 'POST',
        body: JSON.stringify({ title: text, description: getValues('customDescription') }),
      });
      if (res && res.category_id) setAiSuggestion(res);
    } catch (err) {
      console.warn('AI suggestion error:', err);
    } finally {
      setIsAiLoading(false);
    }
  }, [getValues]);

  const applyAiSuggestion = useCallback(() => {
    if (!aiSuggestion) return;
    const targetId = aiSuggestion.subcategory_id || aiSuggestion.category_id;
    if (targetId && categories.some((c) => c.id === targetId)) selectCategory(targetId);
  }, [aiSuggestion, categories, selectCategory]);

  // ── AI: kategoriya filtrlarini (bo'sh maydonlarni) sarlavhadan to'ldiradi ──
  const runAttrPrefill = useCallback(async () => {
    const tt = getValues('title').trim();
    const catId = getValues('categoryId');
    if (tt.length < 3 || !catId || attrSchema.length === 0) return;
    const existing = getValues('attributes') || {};
    setIsAttrPrefilling(true);
    try {
      const res = await aiPrefillAttributes({ title: tt, description: getValues('customDescription'), category_id: catId, existing });
      const incoming = res?.values || {};
      const merged: Record<string, string | number | boolean> = { ...existing };
      const added: string[] = [];
      for (const [k, v] of Object.entries(incoming)) {
        const cur = (merged as any)[k];
        // FAQAT bo'sh maydonlarni to'ldiramiz — foydalanuvchi qiymatini buzmaymiz.
        if (cur === undefined || cur === null || String(cur).trim() === '') {
          merged[k] = v as string | number | boolean;
          added.push(k);
        }
      }
      setValue('attributes', merged, { shouldValidate: true });
      setAiFilledKeys((prev) => Array.from(new Set([...prev, ...added])));
      setAttrPrefillReason(res?.reasoning || '');
    } catch (err) {
      console.warn('AI attribute prefill xato:', err);
    } finally {
      setIsAttrPrefilling(false);
    }
  }, [getValues, setValue, attrSchema]);

  // Sarlavha + kategoriya o'zgarganda filtrlarni BIR MARTA avtomatik to'ldiramiz.
  useEffect(() => {
    const sig = `${categoryId}|${title.trim()}`;
    if (!categoryId || title.trim().length < 3 || attrSchema.length === 0) return;
    if (subcategoriesOfParent.length > 0 && !isLeafSelected) return;
    if (prefillSignatureRef.current === sig) return;
    prefillSignatureRef.current = sig;
    runAttrPrefill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, title, attrSchema, isLeafSelected, subcategoriesOfParent]);

  // ── Media upload ──
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const cur = getValues('images') || [];
    if (cur.length + files.length > 8) { alert(t('create.errMaxImages')); return; }
    setIsUploadingImage(true);
    try {
      let acc = [...cur];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadImageFile(files[i]);
        acc = [...acc, url].slice(0, 8);
        setValue('images', acc);
      }
    } catch (err: any) {
      alert(err.message || t('create.errImage'));
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [getValues, setValue, t]);

  const handleRemoveImage = useCallback((index: number) => {
    setValue('images', (getValues('images') || []).filter((_, idx) => idx !== index));
  }, [getValues, setValue]);

  const handleVideoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const cur = getValues('videos') || [];
    if (cur.length + files.length > 2) { alert(t('create.errMaxVideos')); return; }
    setIsUploadingVideo(true);
    try {
      let acc = [...cur];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadVideoFile(files[i]);
        acc = [...acc, url].slice(0, 2);
        setValue('videos', acc);
      }
    } catch (err: any) {
      alert(err.message || t('create.errVideo'));
    } finally {
      setIsUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  }, [getValues, setValue, t]);

  const handleRemoveVideo = useCallback((index: number) => {
    setValue('videos', (getValues('videos') || []).filter((_, idx) => idx !== index));
  }, [getValues, setValue]);

  // ── GPS ──
  const handleDetectGPS = useCallback(() => {
    if (!navigator.geolocation) { alert(t('create.errGeoUnsupported')); return; }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setValue('latitude', lat);
        setValue('longitude', lon);
        try {
          const detected = await apiRequest<{ region_id: string; district_id: string }>(`/api/locations/detect?lat=${lat}&lon=${lon}`);
          if (detected?.region_id) {
            setValue('regionId', detected.region_id);
            const dists = await apiRequest<District[]>(`/api/locations/districts?region_id=${detected.region_id}`);
            setDistricts(dists);
            if (detected.district_id) setValue('districtId', detected.district_id);
          }
        } catch (err) {
          console.warn('Avtomatik tuman aniqlashda xatolik:', err);
        } finally {
          setIsLocating(false);
        }
      },
      () => { setIsLocating(false); alert(t('create.errGeoDenied')); },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [setValue, t]);

  // ── Tavsif kompozitsiyasi (AI uchun faktlar + fallback) ──
  const buildDescFacts = useCallback((d: WizardFormValues) => {
    const attrList = attrSchema
      .map((a) => {
        const v = d.attributes[a.key];
        return v !== undefined && v !== null && String(v).trim() !== '' ? { label: a.label, value: String(v) } : null;
      })
      .filter(Boolean) as { label: string; value: string }[];
    const region = regions.find((r) => r.id === d.regionId);
    const district = districts.find((x) => x.id === d.districtId);
    const locName = [district ? localized(district) : null, region ? localized(region) : null].filter(Boolean).join(', ');
    const combined = showEmployment ? Array.from(new Set(d.skills)) : [];
    let priceText = '';
    if (isJobs) {
      if (d.salaryType === 'SALARY_NEGOTIABLE') priceText = t('create.salaryNegotiable');
      else if (d.salaryType === 'SALARY_RANGE') priceText = `${d.salaryMin || '?'} – ${d.salaryMax || '?'} ${t('wallet.som')}`;
      else priceText = d.salaryMin ? `${d.salaryMin} ${t('wallet.som')}` : '';
    } else {
      if (d.priceType === 'NEGOTIABLE') priceText = t('create.priceNegotiable');
      else if (d.priceType === 'FREE') priceText = t('create.priceFree');
      else if (d.priceType === 'RANGE') priceText = `${d.priceMin || '?'} – ${d.priceMax || '?'} ${t('wallet.som')}`;
      else priceText = d.priceMin ? `${d.priceMin} ${t('wallet.som')}` : '';
    }
    return {
      title: d.title.trim(),
      typeLabel: d.type ? t(`create.typeMeta.${d.type}.label`) : undefined,
      catalogName: catalogs.find((c) => c.id === d.catalogId) ? localized(catalogs.find((c) => c.id === d.catalogId)!) : undefined,
      categoryName: parentCategoryObj ? localized(parentCategoryObj) : undefined,
      subcategoryName: isLeafSelected && selectedCategoryObj ? localized(selectedCategoryObj) : undefined,
      attributes: attrList,
      features: combined,
      priceText: isJobs ? '' : priceText,
      salaryText: isJobs ? priceText : '',
      location: locName || undefined,
      extra: d.customDescription.trim() || undefined,
    };
  }, [attrSchema, regions, districts, showEmployment, isJobs, localized, t, catalogs, parentCategoryObj, isLeafSelected, selectedCategoryObj]);

  const composeDescription = useCallback((d: WizardFormValues) => {
    const parts: string[] = [];
    if (d.title.trim()) parts.push(d.title.trim());
    if (parentCategoryObj) parts.push(`${t('create.descCategory')}: ${localized(parentCategoryObj)}`);
    if (isLeafSelected && selectedCategoryObj) parts.push(`${t('create.descDirection')}: ${localized(selectedCategoryObj)}`);
    const attrText = attrSchema
      .map((a) => (d.attributes[a.key] !== undefined && d.attributes[a.key] !== '' ? `${a.label}: ${d.attributes[a.key]}` : null))
      .filter(Boolean) as string[];
    if (attrText.length) parts.push(attrText.join(', '));
    const combined = showEmployment ? Array.from(new Set(d.skills)) : [];
    if (combined.length > 0) parts.push(`${t('create.descFeatures')}: ${combined.join(', ')}`);
    if (d.customDescription.trim()) parts.push(`${t('create.descExtra')}: ${d.customDescription.trim()}`);
    return parts.join('. ') + (parts.length ? '.' : '');
  }, [attrSchema, showEmployment, parentCategoryObj, selectedCategoryObj, isLeafSelected, localized, t]);

  // ── Payload quruvchi (submit + qoralama uchun umumiy) ──
  // `opts.publish=false` => server DRAFT qiladi (token/validatsiya yengil).
  const buildPayload = useCallback((d: WizardFormValues, description: string, opts: { publish: boolean }): JobPostingPayload => {
    const combinedSkills = Array.from(new Set(showEmployment ? d.skills : []));
    return {
      catalog_id: d.catalogId,
      type: d.type as ListingType,
      title: d.title.trim(),
      description,
      category_id: d.categoryId,
      region_id: d.regionId,
      district_id: d.districtId,
      latitude: d.latitude,
      longitude: d.longitude,
      price_type: d.priceType,
      price_min: d.priceMin ? parseFloat(d.priceMin) : undefined,
      price_max: d.priceMax ? parseFloat(d.priceMax) : undefined,
      salary_type: isJobs ? d.salaryType : undefined,
      salary_min: d.salaryMin ? parseFloat(d.salaryMin) : undefined,
      salary_max: d.salaryMax ? parseFloat(d.salaryMax) : undefined,
      work_format: showEmployment ? d.workFormat : undefined,
      experience_level: showEmployment ? d.experienceLevel || undefined : undefined,
      skills: combinedSkills,
      attributes: d.attributes,
      contact_time: d.contactTime,
      contact_custom_text: d.contactCustomText || undefined,
      organization_id: d.organizationId || undefined,
      images: d.images,
      videos: d.videos,
      publish: opts.publish,
      captchaToken: opts.publish ? captchaTokenRef.current || undefined : undefined,
    };
  }, [showEmployment, isJobs]);

  // ── Submit (joylash) ──
  const handleValid = useCallback(async (d: WizardFormValues) => {
    setSubmitError('');
    setIsSubmitting(true);

    // Qoralamadan joylash: draftId mavjud (sessiya ichida saqlangan yoki DRAFT
    // sifatida ochilgan). Bunday holatda avval PUT bilan ma'lumotni yangilaymiz,
    // so'ng /:id/publish chaqiramiz (to'liq validatsiya + narx + ACTIVE).
    const isDraftPublish = isDraftEditing || !!draftIdRef.current;

    let descriptionToSend = composeDescription(d);
    // AI tavsif: yangi e'lon yoki qoramadan birinchi joylashda; ACTIVE editda skip.
    if (!isEditing || isDraftEditing) {
      setIsGeneratingDesc(true);
      try {
        const ai = await aiGenerateDescription(buildDescFacts(d));
        if (ai?.description && ai.description.trim().length >= 15) {
          descriptionToSend = ai.note ? `${ai.description.trim()}\n\n${ai.note.trim()}` : ai.description.trim();
        }
      } catch {
        /* fallback: composeDescription */
      } finally {
        setIsGeneratingDesc(false);
      }
    }

    const payload = buildPayload(d, descriptionToSend, { publish: true });

    try {
      if (isDraftPublish) {
        const id = draftIdRef.current || editListingId!;
        await apiRequest(`/api/listings/${id}`, { method: 'PUT', body: JSON.stringify({ ...payload, publish: undefined, captchaToken: undefined }) });
        const res = await apiRequest<any>(`/api/listings/${id}/publish`, { method: 'POST', body: JSON.stringify({ captchaToken: captchaTokenRef.current || undefined }) });
        onCreated(res?.listing?.id || id);
      } else if (isEditing && editListingId) {
        const updated = await apiRequest<any>(`/api/listings/${editListingId}`, { method: 'PUT', body: JSON.stringify(payload) });
        onCreated(updated?.id || editListingId);
      } else {
        const res = await apiRequest<any>('/api/listings', { method: 'POST', body: JSON.stringify(payload) });
        onCreated(res.id);
      }
    } catch (err: any) {
      setSubmitError(err.message || (isEditing ? t('create.errEdit') : t('create.errCreate')));
      setIsSubmitting(false);
    }
  }, [isDraftEditing, isEditing, editListingId, composeDescription, buildDescFacts, buildPayload, onCreated, t]);

  // ── Qoralama saqlash (publish=false) ──
  // Birinchi marta POST bilan DRAFT yaratadi; keyingi saqlashlar shu id'ga PUT.
  const saveDraft = useCallback(async () => {
    setSubmitError('');
    const d = getValues();
    // Minimal talab: NOT NULL ustunlar + yo'l validatsiyasi (tur/kategoriya/lokatsiya/sarlavha).
    if (!d.catalogId || !d.type || !d.categoryId || !d.title.trim() || !d.regionId || !d.districtId) {
      setSubmitError(t('create.draftNeedFields'));
      return;
    }
    setIsSavingDraft(true);
    try {
      const payload = buildPayload(d, composeDescription(d), { publish: false });
      const id = draftIdRef.current || (isEditing ? editListingId : null);
      if (id) {
        await apiRequest(`/api/listings/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        draftIdRef.current = id;
      } else {
        const res = await apiRequest<any>('/api/listings', { method: 'POST', body: JSON.stringify(payload) });
        draftIdRef.current = res.id;
      }
      setIsDraftEditing(true);
      setLastDraftSavedAt(Date.now());
    } catch (err: any) {
      setSubmitError(err.message || t('create.errDraftSave'));
    } finally {
      setIsSavingDraft(false);
    }
  }, [getValues, buildPayload, composeDescription, isEditing, editListingId, t]);

  // ── Avtosaqlash: faqat mavjud qoralama (id) bo'lganda, o'zgarishlardan ~2.5s keyin PUT ──
  useEffect(() => {
    if (!isDraftEditing) return;
    const sub = watch(() => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(() => {
        const id = draftIdRef.current;
        if (!id) return;
        const d = getValues();
        if (!d.title.trim() || !d.categoryId || !d.regionId || !d.districtId) return;
        const payload = buildPayload(d, composeDescription(d), { publish: false });
        apiRequest(`/api/listings/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
          .then(() => setLastDraftSavedAt(Date.now()))
          .catch(() => { /* jim o'tamiz */ });
      }, 2500);
    });
    return () => {
      sub.unsubscribe();
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [isDraftEditing, watch, getValues, buildPayload, composeDescription]);

  const onCaptchaChange = useCallback((token: string) => { captchaTokenRef.current = token; }, []);

  const handleInvalid = useCallback(() => {
    setSubmitError(t('wizard.fixErrors'));
  }, [t]);

  const onCancel = useCallback(() => {
    if (isEditing) { onNavigate(`/listing/${editListingId}`); return; }
    // Yangi e'lon: Back (Step 1) — tanlovni tozalaydi.
    setValue('catalogId', '');
    setValue('type', '');
    setValue('categoryId', '');
  }, [isEditing, editListingId, onNavigate, setValue]);

  // ── Controller (konteyner => qadam komponentlari) ──
  const ctl: WizardController = useMemo(() => ({
    catalogs, categories, regions, districts, userOrgs, attrSchema, monetization,
    isJobs, isServices, showEmployment, isLeafSelected, subcategoriesOfParent, parentCategories,
    t, localized, intlLocale, userName: user?.name,
    aiSuggestion, isAiLoading, aiFilledKeys, isAttrPrefilling, attrPrefillReason, isGeneratingDesc,
    isUploadingImage, isUploadingVideo, isLocating, fileInputRef, videoInputRef,
    isEditing,
    isDraftEditing, isSavingDraft, lastDraftSavedAt,
    captchaSitekey, onCaptchaChange,
    chooseCatalog, chooseType, selectCategory, requestAiSuggestion, applyAiSuggestion, runAttrPrefill,
    handleToggleFeature, handleImageUpload, handleRemoveImage, handleVideoUpload, handleRemoveVideo, handleDetectGPS,
    saveDraft,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    catalogs, categories, regions, districts, userOrgs, attrSchema, monetization, isJobs, isServices, showEmployment,
    isLeafSelected, subcategoriesOfParent, parentCategories, t, localized, intlLocale, user?.name, aiSuggestion, isAiLoading,
    aiFilledKeys, isAttrPrefilling, attrPrefillReason, isGeneratingDesc, isUploadingImage, isUploadingVideo, isLocating,
    isEditing, isDraftEditing, isSavingDraft, lastDraftSavedAt, captchaSitekey, onCaptchaChange, saveDraft,
    chooseCatalog, chooseType, selectCategory, requestAiSuggestion, applyAiSuggestion, runAttrPrefill,
    handleToggleFeature, handleImageUpload, handleRemoveImage, handleVideoUpload, handleRemoveVideo, handleDetectGPS,
  ]);

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-10 pb-6">
      {isLoadingEdit ? (
        <div className="space-y-4 animate-pulse">
          <div className="w-48 h-8 bg-gray-200 rounded-lg" />
          <div className="h-96 bg-gray-100 rounded-3xl" />
        </div>
      ) : (
        <FormProvider {...methods}>
          <WizardControllerProvider value={ctl}>
            <StepWizard
              onFinalSubmit={handleValid}
              onInvalid={handleInvalid}
              isSubmitting={isSubmitting}
              submitError={submitError}
              onCancel={onCancel}
            />
          </WizardControllerProvider>
        </FormProvider>
      )}
    </div>
  );
};

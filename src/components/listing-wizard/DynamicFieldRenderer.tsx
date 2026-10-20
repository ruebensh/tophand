// ============================================================================
//  DynamicFieldRenderer — WIZARD Step 2 (Dinamik atributlar + forma bloklari).
//  Kategoriya atribut sxemasini RHF Controller orqali chiqaradi; ustiga AI
//  to'ldirish tugmasi + aiFilledKeys badge + qizil ko'rik eslatmasi (mavjud
//  logika saqlanadi). Jobs/sell shartli bloklar: maosh/narx, bandlik, ko'nikma
//  autosuggest, afzalliklar, media, aloqa, tashkilot, qo'shimcha izoh.
// ============================================================================

import React, { useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  Sparkles, Wand2, TriangleAlert, Check, UploadCloud, X,
  Building2, DollarSign, SlidersHorizontal, ShieldCheck, ChevronDown, Tag,
} from 'lucide-react';
import type { CategoryAttribute, WorkFormat, ContactTime, PriceType, SalaryType } from '../../types/index.ts';
import type { WizardFormValues } from '../../types/wizard.ts';
import { useWizardController } from './wizardContext.tsx';
import { INPUT_CLS, chipCls, FieldError, SelectAttrField, MultiselectAttrField } from './fields.tsx';
import { PRESET_FEATURES } from './wizardMeta.ts';
import AutosuggestInput from './AutosuggestInput.tsx';

// Bitta dinamik atribut maydoni — turiga qarab kontrol tanlanadi, RHF'ga bog'lanadi.
const AttrField: React.FC<{ attr: CategoryAttribute }> = ({ attr }) => {
  const { t } = useWizardController();
  const { control } = useFormContext<WizardFormValues>();
  return (
    <Controller
      control={control}
      name={`attributes.${attr.key}`}
      render={({ field, fieldState }) => {
        const val = field.value as string | number | boolean | undefined;
        const setAttr = (v: string | number | boolean | undefined) => {
          field.onChange(v === undefined || v === '' ? undefined : v);
        };
        let control_$: React.ReactNode;
        switch (attr.type) {
          case 'select':
          case 'color':
            control_$ = <SelectAttrField attr={attr} value={typeof val === 'string' ? val : ''} onChange={setAttr} />;
            break;
          case 'bool':
            control_$ = (
              <div className="flex gap-2">
                {[{ v: true, l: t('common.yes') }, { v: false, l: t('common.no') }].map((o) => (
                  <button key={o.l} type="button" onClick={() => setAttr(o.v)} className={chipCls(val === o.v)}>
                    {val === o.v && <Check className="w-3.5 h-3.5" />} {o.l}
                  </button>
                ))}
              </div>
            );
            break;
          case 'multiselect':
            control_$ = <MultiselectAttrField attr={attr} value={typeof val === 'string' ? val : ''} onChange={setAttr} />;
            break;
          case 'number':
          case 'year':
            control_$ = (
              <div className="relative">
                <input
                  type="number"
                  min={attr.type === 'year' ? 1950 : undefined}
                  max={attr.type === 'year' ? new Date().getFullYear() : undefined}
                  value={typeof val === 'number' ? String(val) : typeof val === 'string' ? val : ''}
                  onChange={(e) => setAttr(e.target.value === '' ? undefined : Number(e.target.value))}
                  className={INPUT_CLS}
                  placeholder={attr.unit || ''}
                />
                {attr.unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400">{attr.unit}</span>}
              </div>
            );
            break;
          case 'range':
            control_$ = (
              <input
                type="text"
                value={typeof val === 'string' ? val : ''}
                onChange={(e) => setAttr(e.target.value)}
                className={INPUT_CLS}
                placeholder={attr.unit ? t('create.rangeExampleUnit', { unit: attr.unit }) : t('create.rangeExample')}
              />
            );
            break;
          default:
            control_$ = (
              <input
                type="text"
                value={typeof val === 'string' ? val : ''}
                onChange={(e) => setAttr(e.target.value)}
                className={INPUT_CLS}
              />
            );
        }
        return (
          <div>
            {control_$}
            <FieldError message={fieldState.error?.message} />
          </div>
        );
      }}
    />
  );
};

const DynamicFieldRenderer: React.FC = () => {
  const ctl = useWizardController();
  const { t, attrSchema, userOrgs, isJobs, isServices, showEmployment } = ctl;
  const { control, register, watch, formState: { errors } } = useFormContext<WizardFormValues>();

  const [isCustomDescOpen, setIsCustomDescOpen] = useState(false);
  const type_ = watch('type');
  const skills = watch('skills') || [];
  const organizationId = watch('organizationId');

  const orgVisible = userOrgs.length > 0 && (type_ === 'JOB_OPENING' || type_ === 'SERVICE_OFFER' || type_ === 'SELL');

  return (
    <div className="space-y-6">
      {/* ORGANIZATION */}
      {orgVisible && (
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-gray-500" /> {t('create.orgLabel')}
          </label>
          <select {...register('organizationId')} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500">
            <option value="">{t('create.orgSelf', { name: ctl.userName || '' })}</option>
            {userOrgs.map((org) => (
              <option key={org.id} value={org.id}>{t('create.orgPrefix', { name: org.name })}</option>
            ))}
          </select>
        </div>
      )}

      {/* DYNAMIC ATTRIBUTES */}
      {attrSchema.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-100 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              {t('create.paramsOf', { name: t('create.category') })}
            </label>
            <button
              type="button"
              onClick={ctl.runAttrPrefill}
              disabled={ctl.isAttrPrefilling || !watch('title') || watch('title').trim().length < 3}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold border border-purple-200 transition-all cursor-pointer disabled:opacity-40 shrink-0"
            >
              <Wand2 className={`w-3.5 h-3.5 ${ctl.isAttrPrefilling ? 'animate-pulse' : ''}`} />
              <span>{ctl.isAttrPrefilling ? t('create.aiPrefilling') : t('create.aiPrefillBtn')}</span>
            </button>
          </div>

          {/* Qizil eslatma: AI to'ldirgan ma'lumotlarni foydalanuvchi o'zi tekshirishi shart */}
          <div className="flex items-start gap-1.5 text-[11px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-2">
            <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{t('create.aiReviewWarn')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {attrSchema.map((attr) => (
              <div key={attr.id}>
                <label className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 mb-1">
                  <span>{attr.label} {attr.required && <span className="text-rose-500">*</span>}</span>
                  {ctl.aiFilledKeys.includes(attr.key) && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[9px] font-bold">
                      <Sparkles className="w-2.5 h-2.5" /> {t('create.aiBadge')}
                    </span>
                  )}
                </label>
                <AttrField attr={attr} />
              </div>
            ))}
          </div>

          {ctl.aiFilledKeys.length > 0 && ctl.attrPrefillReason && (
            <p className="text-[11px] text-purple-700/80 leading-snug">✨ {ctl.attrPrefillReason}</p>
          )}
        </div>
      )}

      {/* SERVICES: preset afzalliklar (skills maydoniga yoziladi) */}
      {isServices && (
        <div className="p-4 rounded-2xl bg-blue-50/40 border border-blue-100/70">
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> {t('create.features')}
            </label>
            <span className="text-[11px] text-blue-600 font-semibold">{t('create.countTa', { n: skills.length })}</span>
          </div>
          <Controller
            control={control}
            name="skills"
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                {PRESET_FEATURES.map((feat) => {
                  const on = field.value.includes(feat);
                  return (
                    <button
                      key={feat}
                      type="button"
                      onClick={() => field.onChange(on ? field.value.filter((x) => x !== feat) : [...field.value, feat])}
                      className={chipCls(on, 'emerald')}
                    >
                      {on && <Check className="w-3.5 h-3.5" />} <span>{feat}</span>
                    </button>
                  );
                })}
              </div>
            )}
          />
        </div>
      )}

      {/* JOBS: skills autosuggest (300ms debounce + custom) */}
      {isJobs && (
        <div className="p-4 rounded-2xl bg-violet-50/40 border border-violet-100/70 space-y-2">
          <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-violet-600" /> {t('wizard.skillsTitle')}
          </label>
          <Controller
            control={control}
            name="skills"
            render={({ field }) => <AutosuggestInput value={field.value} onChange={field.onChange} />}
          />
        </div>
      )}

      {/* WORK FORMAT & EXPERIENCE (jobs/services) */}
      {showEmployment && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-2">{t('create.workPlace')}</label>
            <Controller
              control={control}
              name="workFormat"
              render={({ field }) => (
                <div className="grid grid-cols-3 gap-2">
                  {[{ id: 'ONSITE', label: t('create.workOnsite') }, { id: 'REMOTE', label: t('create.workRemote') }, { id: 'HYBRID', label: t('create.workHybrid') }].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => field.onChange(f.id as WorkFormat)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                        field.value === f.id ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-800 mb-2">{t('create.experience')}</label>
            <Controller
              control={control}
              name="experienceLevel"
              render={({ field }) => (
                <div className="grid grid-cols-4 gap-1.5">
                  {[{ id: 'none', label: t('create.expNew') }, { id: '1-3', label: t('create.exp13') }, { id: '3-5', label: t('create.exp35') }, { id: '5+', label: t('create.exp5plus') }].map((exp) => (
                    <button
                      key={exp.id}
                      type="button"
                      onClick={() => field.onChange(exp.id)}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        field.value === exp.id ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {exp.label}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>
        </div>
      )}

      {/* PRICING / SALARY */}
      {isJobs ? (
        <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-3">
          <h4 className="font-bold text-xs text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-purple-600" /> {t('create.salaryTitle')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select {...register('salaryType')} className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-purple-500">
              <option value="SALARY_FIXED">{t('create.salaryFixed')}</option>
              <option value="SALARY_RANGE">{t('create.salaryRange')}</option>
              <option value="SALARY_NEGOTIABLE">{t('create.salaryNegotiable')}</option>
            </select>
            <div className="space-y-1">
              {watch('salaryType') !== 'SALARY_NEGOTIABLE' && (
                <input type="number" placeholder={t('create.salaryMinPh')} {...register('salaryMin')} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 w-full" />
              )}
              <FieldError message={(errors.salaryMin as any)?.message} />
            </div>
            <div className="space-y-1">
              {watch('salaryType') === 'SALARY_RANGE' && (
                <input type="number" placeholder={t('create.salaryMaxPh')} {...register('salaryMax')} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-purple-500 w-full" />
              )}
              <FieldError message={(errors.salaryMax as any)?.message} />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-3">
          <h4 className="font-bold text-xs text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-blue-600" /> {t('create.priceTitle')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select {...register('priceType')} className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-blue-500">
              <option value="FIXED">{t('create.priceFixed')}</option>
              <option value="FROM">{t('create.priceFrom')}</option>
              <option value="RANGE">{t('create.priceRange')}</option>
              <option value="NEGOTIABLE">{t('create.priceNegotiable')}</option>
              <option value="FREE">{t('create.priceFree')}</option>
            </select>
            <div className="space-y-1">
              {watch('priceType') !== 'NEGOTIABLE' && watch('priceType') !== 'FREE' && (
                <input type="number" placeholder={t('create.amountPh')} {...register('priceMin')} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 w-full" />
              )}
              <FieldError message={(errors.priceMin as any)?.message} />
            </div>
            <div className="space-y-1">
              {watch('priceType') === 'RANGE' && (
                <input type="number" placeholder={t('create.salaryMaxPh')} {...register('priceMax')} className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-blue-500 w-full" />
              )}
              <FieldError message={(errors.priceMax as any)?.message} />
            </div>
          </div>
        </div>
      )}

      {/* CONTACT TIME */}
      <div>
        <label className="block text-xs font-bold text-gray-800 mb-2">{t('create.contactTimeLabel')}</label>
        <Controller
          control={control}
          name="contactTime"
          render={({ field }) => (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[{ id: 'ANY_TIME', label: t('create.ctAny') }, { id: 'MORNING', label: t('create.ctMorning') }, { id: 'AFTERNOON', label: t('create.ctAfternoon') }, { id: 'EVENING', label: t('create.ctEvening') }].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => field.onChange(item.id as ContactTime)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                    field.value === item.id ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      {/* QO'SHIMCHA IZOH */}
      <div className="p-4 rounded-2xl bg-linear-to-br from-blue-50/60 to-indigo-50/60 border border-blue-100">
        <button type="button" onClick={() => setIsCustomDescOpen(!isCustomDescOpen)} className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer">
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isCustomDescOpen ? 'rotate-180' : ''}`} />
          <span>{isCustomDescOpen ? t('create.closeExtra') : t('create.openExtra')}</span>
        </button>
        {isCustomDescOpen && (
          <textarea rows={3} {...register('customDescription')} placeholder={t('create.extraPh')} className="mt-2.5 w-full bg-white border border-blue-200 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-blue-500" />
        )}
      </div>

      {/* IMAGES */}
      <Controller
        control={control}
        name="images"
        render={({ field }) => (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-800">{t('create.imagesLabel')}</label>
              <span className="text-[11px] text-gray-400">{field.value.length}/8</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {field.value.map((url, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-gray-200">
                  <img src={url} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                  <button type="button" onClick={() => ctl.handleRemoveImage(idx)} className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600 text-white shadow-md cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {idx === 0 && <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-blue-600 text-white">{t('create.cover')}</span>}
                </div>
              ))}
              {field.value.length < 8 && (
                <button type="button" disabled={ctl.isUploadingImage} onClick={() => ctl.fileInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/30 flex flex-col items-center justify-center p-3 transition-colors cursor-pointer">
                  <UploadCloud className={`w-6 h-6 text-gray-400 mb-1 ${ctl.isUploadingImage ? 'animate-bounce text-blue-600' : ''}`} />
                  <span className="text-[11px] font-bold text-gray-600">{ctl.isUploadingImage ? t('create.uploading') : t('create.uploadImage')}</span>
                </button>
              )}
            </div>
            <input type="file" ref={ctl.fileInputRef} onChange={ctl.handleImageUpload} accept="image/*" multiple className="hidden" />
          </div>
        )}
      />

      {/* VIDEOS */}
      <Controller
        control={control}
        name="videos"
        render={({ field }) => (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-800">{t('create.videosLabel')}</label>
              <span className="text-[11px] text-gray-400">{field.value.length}/2</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {field.value.map((url, idx) => (
                <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-gray-200 bg-black">
                  <video src={url} className="w-full h-full object-cover" muted playsInline />
                  <button type="button" onClick={() => ctl.handleRemoveVideo(idx)} className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600 text-white shadow-md cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <span className="absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-violet-600 text-white">{t('create.videoTag')}</span>
                </div>
              ))}
              {field.value.length < 2 && (
                <button type="button" disabled={ctl.isUploadingVideo} onClick={() => ctl.videoInputRef.current?.click()} className="aspect-square rounded-2xl border-2 border-dashed border-gray-300 hover:border-violet-500 hover:bg-violet-50/30 flex flex-col items-center justify-center p-3 transition-colors cursor-pointer">
                  <UploadCloud className={`w-6 h-6 text-gray-400 mb-1 ${ctl.isUploadingVideo ? 'animate-bounce text-violet-600' : ''}`} />
                  <span className="text-[11px] font-bold text-gray-600">{ctl.isUploadingVideo ? t('create.uploading') : t('create.uploadVideo')}</span>
                </button>
              )}
            </div>
            <input type="file" ref={ctl.videoInputRef} onChange={ctl.handleVideoUpload} accept="video/mp4,video/webm" className="hidden" />
          </div>
        )}
      />
    </div>
  );
};

export default DynamicFieldRenderer;

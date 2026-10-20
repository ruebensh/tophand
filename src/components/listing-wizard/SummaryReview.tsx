// ============================================================================
//  SummaryReview — WIZARD Step 4 (Xulosa va ko'rik).
//  Barcha javoblar guruhlangan (Kategoriya / Tafsilotlar+Atributlar / Lokatsiya /
//  Media / Aloqa), har guruhda mos qadamga qaytadigan "O'zgartirish" tugmasi.
//  Yakuniy Submit StepWizard qobig'ida (zod to'liq tekshiradi + AI tavsif).
// ============================================================================

import React from 'react';
import { useWatch, useFormContext } from 'react-hook-form';
import { Pencil, Image as ImageIcon, Video, MapPin, SlidersHorizontal, Tag, PhoneCall, FolderTree } from 'lucide-react';
import type { WizardFormValues } from '../../types/wizard.ts';
import { useWizardController } from './wizardContext.tsx';

const GroupCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  onEdit: () => void;
  children: React.ReactNode;
}> = ({ title, icon, onEdit, children }) => {
  const { t } = useWizardController();
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-gray-900 flex items-center gap-1.5">{icon} {title}</h3>
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer">
          <Pencil className="w-3.5 h-3.5" /> {t('wizard.edit')}
        </button>
      </div>
      {children}
    </div>
  );
};

const Row: React.FC<{ k: string; v?: React.ReactNode }> = ({ k, v }) => (
  <div className="flex items-start justify-between gap-3 text-xs py-0.5">
    <span className="text-gray-500 font-medium shrink-0">{k}</span>
    <span className="text-gray-900 font-bold text-right break-words">{v || '—'}</span>
  </div>
);

const SummaryReview: React.FC<{ onEdit: (step: number) => void }> = ({ onEdit }) => {
  const ctl = useWizardController();
  const { t, localized, attrSchema, isJobs, showEmployment, monetization, intlLocale } = ctl;
  const { control } = useFormContext<WizardFormValues>();
  const v = useWatch({ control }) as WizardFormValues;

  const catalog = ctl.catalogs.find((c) => c.id === v.catalogId);
  const category = ctl.categories.find((c) => c.id === v.categoryId);
  const parentCategory = ctl.categories.find((c) => c.id === category?.parent_id) || category;
  const region = ctl.regions.find((r) => r.id === v.regionId);
  const district = ctl.districts.find((d) => d.id === v.districtId);

  const filledAttrs = attrSchema.filter((a) => {
    const val = v.attributes?.[a.key];
    return val !== undefined && val !== null && String(val).trim() !== '';
  });

  const salaryText = (() => {
    if (v.salaryType === 'SALARY_NEGOTIABLE') return t('create.salaryNegotiable');
    if (v.salaryType === 'SALARY_RANGE') return `${v.salaryMin || '?'} – ${v.salaryMax || '?'} ${t('wallet.som')}`;
    return v.salaryMin ? `${v.salaryMin} ${t('wallet.som')}` : '';
  })();
  const priceText = (() => {
    if (v.priceType === 'NEGOTIABLE') return t('create.priceNegotiable');
    if (v.priceType === 'FREE') return t('create.priceFree');
    if (v.priceType === 'RANGE') return `${v.priceMin || '?'} – ${v.priceMax || '?'} ${t('wallet.som')}`;
    return v.priceMin ? `${v.priceMin} ${t('wallet.som')}` : '';
  })();

  return (
    <div className="space-y-4">
      <div className="text-center max-w-lg mx-auto">
        <h2 className="text-lg font-black text-gray-900">{t('wizard.summaryTitle')}</h2>
        <p className="text-xs text-gray-500 mt-1">{t('wizard.summaryHint')}</p>
      </div>

      {/* KATEGORIYA */}
      <GroupCard title={t('wizard.step.category')} icon={<FolderTree className="w-3.5 h-3.5 text-blue-600" />} onEdit={() => onEdit(0)}>
        <Row k={t('create.category')} v={catalog ? localized(catalog) : undefined} />
        {v.type && <Row k={t('create.typeTitle')} v={t(`create.typeMeta.${v.type}.label`)} />}
        <Row k={t('create.name')} v={v.title} />
        <Row k={t('create.subcategory')} v={parentCategory ? localized(parentCategory) : (category ? localized(category) : undefined)} />
      </GroupCard>

      {/* TAFSILOTLAR + ATRIBUTLAR */}
      <GroupCard title={t('wizard.step.details')} icon={<SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />} onEdit={() => onEdit(1)}>
        {filledAttrs.length > 0 ? (
          filledAttrs.map((a) => <Row key={a.id} k={a.label} v={String(v.attributes[a.key])} />)
        ) : (
          <p className="text-[11px] text-gray-400">{t('wizard.noAttrs')}</p>
        )}
        {showEmployment && (
          <>
            <Row k={t('create.workPlace')} v={v.workFormat ? t(`create.work${v.workFormat.charAt(0)}${v.workFormat.slice(1).toLowerCase()}` as any) || v.workFormat : undefined} />
            <Row k={t('create.experience')} v={v.experienceLevel} />
          </>
        )}
        {isJobs && <Row k={t('create.salaryTitle')} v={salaryText} />}
        {!isJobs && <Row k={t('create.priceTitle')} v={priceText} />}
        {v.skills && v.skills.length > 0 && (
          <div className="pt-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 mb-1"><Tag className="w-3 h-3" /> {isJobs ? t('wizard.skillsTitle') : t('create.features')}</div>
            <div className="flex flex-wrap gap-1.5">
              {v.skills.map((s) => (
                <span key={s} className="px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-bold">{s}</span>
              ))}
            </div>
          </div>
        )}
        {v.customDescription?.trim() && <Row k={t('create.descExtra')} v={v.customDescription.trim()} />}
      </GroupCard>

      {/* LOKATSIYA */}
      <GroupCard title={t('wizard.step.location')} icon={<MapPin className="w-3.5 h-3.5 text-blue-600" />} onEdit={() => onEdit(2)}>
        <Row k={t('create.regionLabel')} v={region ? localized(region) : undefined} />
        <Row k={t('create.districtLabel')} v={district ? localized(district) : undefined} />
        {v.latitude && v.longitude && <Row k="GPS" v={`${v.latitude.toFixed(4)}, ${v.longitude.toFixed(4)}`} />}
      </GroupCard>

      {/* MEDIA */}
      <GroupCard title={t('create.imagesLabel')} icon={<ImageIcon className="w-3.5 h-3.5 text-blue-600" />} onEdit={() => onEdit(1)}>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5" /> {(v.images || []).length}/8</span>
          <span className="inline-flex items-center gap-1"><Video className="w-3.5 h-3.5" /> {(v.videos || []).length}/2</span>
        </div>
        {(v.images || []).length > 0 && (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-1">
            {v.images.slice(0, 6).map((u, i) => (
              <img key={i} src={u} alt="" className="aspect-square rounded-lg object-cover border border-gray-100" />
            ))}
          </div>
        )}
      </GroupCard>

      {/* ALOQA */}
      <GroupCard title={t('create.contactTimeLabel')} icon={<PhoneCall className="w-3.5 h-3.5 text-blue-600" />} onEdit={() => onEdit(1)}>
        <Row
          k={t('create.contactTimeLabel')}
          v={
            v.contactTime === 'ANY_TIME' ? t('create.ctAny')
              : v.contactTime === 'MORNING' ? t('create.ctMorning')
              : v.contactTime === 'AFTERNOON' ? t('create.ctAfternoon')
              : v.contactTime === 'EVENING' ? t('create.ctEvening')
              : v.contactTime
          }
        />
      </GroupCard>

      {/* MONETIZATION NOTICE */}
      {!ctl.isEditing && (() => {
        const activeDays = monetization?.active_days ?? 30;
        const isPaid = monetization?.mode === 'PAID';
        const listingPrice = monetization ? (isJobs ? monetization.prices.listing.jobs : monetization.prices.listing.services) : 0;
        return (
          <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed flex items-center gap-2 ${isPaid ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-emerald-50/70 border-emerald-100 text-emerald-900'}`}>
            <span>{isPaid ? <b>{t('create.paidLabel')} {listingPrice.toLocaleString(intlLocale)} {t('wallet.som')}</b> : <b>{t('create.testTitle')}</b>}</span>
            <span>{isPaid ? t('create.paidSuffix', { n: activeDays }) : t('create.testBody', { n: activeDays })}</span>
          </div>
        );
      })()}
    </div>
  );
};

export default SummaryReview;

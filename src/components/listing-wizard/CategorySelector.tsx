// ============================================================================
//  CategorySelector — WIZARD Step 1 (Kategoriya va ierarxiya).
//  katalog → (jobs: tur) → kategoriya → subkategoriya cascade + sarlavha-birinchi
//  AI detektor (/api/ai/suggest-category). Butun tanlov RHF omboriga yoziladi.
// ============================================================================

import React from 'react';
import { useFormContext } from 'react-hook-form';
import { ArrowLeft, Sparkles, Check, ChevronRight, Tag } from 'lucide-react';
import type { Catalog, ListingType } from '../../types/index.ts';
import type { WizardFormValues } from '../../types/wizard.ts';
import { useWizardController } from './wizardContext.tsx';
import { chipCls } from './fields.tsx';
import { TYPE_META, CAT_TONE } from './wizardMeta.ts';
import { CategoryChip } from '../common/CategoryIcon.tsx';

const CategorySelector: React.FC = () => {
  const ctl = useWizardController();
  const { t, localized, catalogs, categories, parentCategories, subcategoriesOfParent, isLeafSelected } = ctl;
  const { register, watch, setValue, formState: { errors } } = useFormContext<WizardFormValues>();

  const catalogId = watch('catalogId');
  const type = watch('type');
  const categoryId = watch('categoryId');
  const title = watch('title');

  const selectedCatalog = catalogs.find((c) => c.id === catalogId) || null;
  const catalogTypes = (selectedCatalog?.listing_types || '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => !!TYPE_META[x as ListingType]) as ListingType[];
  const needsTypeFirst = catalogId === 'jobs';
  const selectedCategoryObj = categories.find((c) => c.id === categoryId);

  const BackBtn: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
    >
      <ArrowLeft className="w-4 h-4" /> <span>{label}</span>
    </button>
  );

  const Header: React.FC<{ subtitle: string }> = ({ subtitle }) => (
    <div className="text-center max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-2 mb-2">
        {selectedCatalog && <CategoryChip name={selectedCatalog.icon} tone={CAT_TONE[selectedCatalog.id]} size="md" />}
        <h1 className="text-xl sm:text-2xl font-black text-gray-900">{selectedCatalog ? localized(selectedCatalog) : t('create.step1Title')}</h1>
      </div>
      <p className="text-xs sm:text-sm text-gray-500 mt-1">{subtitle}</p>
    </div>
  );

  // ── Stagem: qaysi ko'rinishni chiqarish ──
  let stage: 'catalog' | 'type' | 'category' | 'subcat' | 'ready';
  if (!selectedCatalog) stage = 'catalog';
  else if (needsTypeFirst && !type) stage = 'type';
  else if (!categoryId) stage = 'category';
  else if (subcategoriesOfParent.length > 0 && !isLeafSelected) stage = 'subcat';
  else if (!type) stage = 'type';
  else stage = 'ready';

  // ── AI banner (sarlavha-birinchi) ──
  const AiBanner = (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-bold text-gray-800">{t('create.name')} <span className="text-rose-500">*</span></label>
        <button
          type="button"
          onClick={() => ctl.requestAiSuggestion(title)}
          disabled={ctl.isAiLoading || !title.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-[11px] font-bold transition-all border border-purple-200 cursor-pointer disabled:opacity-40"
        >
          <Sparkles className={`w-3.5 h-3.5 ${ctl.isAiLoading ? 'animate-spin' : ''}`} />
          <span>{ctl.isAiLoading ? t('create.aiAnalyzing') : t('create.aiDetect')}</span>
        </button>
      </div>
      <input
        type="text"
        {...register('title')}
        onBlur={() => { if (title.trim().length >= 5 && !categoryId && !ctl.aiSuggestion) ctl.requestAiSuggestion(title); }}
        placeholder={t('create.titlePlaceholder')}
        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs sm:text-sm font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
      />
      {errors.title && <p className="text-[11px] font-semibold text-rose-600">{errors.title.message}</p>}
      <p className="text-[11px] text-gray-500">{t('create.aiNameFirstHint')}</p>
      {ctl.aiSuggestion && (
        <div className="mt-1 p-3.5 rounded-2xl bg-gradient-to-r from-purple-50/90 via-indigo-50/80 to-blue-50/90 border border-purple-200 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">✨</div>
              <div>
                <span className="text-xs font-bold text-gray-900">
                  {t('create.aiSuggestion')}: {ctl.aiSuggestion.category_id && categories.find((c) => c.id === ctl.aiSuggestion!.category_id) ? localized(categories.find((c) => c.id === ctl.aiSuggestion!.category_id)!) : t('create.aiFound')}
                </span>
                <p className="text-[11px] text-gray-600 mt-0.5 leading-snug">{ctl.aiSuggestion.reasoning_uz || t('create.aiReasonFallback')}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={ctl.applyAiSuggestion}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> <span>{t('create.aiApply')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (stage === 'catalog') {
    return (
      <div className="apple-page-enter space-y-6">
        <div className="text-center max-w-lg mx-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-3 border border-blue-100">
            <Sparkles className="w-3.5 h-3.5" /> {t('create.brandBadge')}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">{t('create.step1Title')}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-2">{t('create.step1Hint')}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white divide-y divide-gray-100 overflow-hidden">
          {catalogs.map((cat: Catalog, ci: number) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => ctl.chooseCatalog(cat)}
              className="mega-cat-item apple-tap w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-blue-50/60 active:bg-blue-50 transition-colors group cursor-pointer"
              style={{ '--mi': `${ci * 25}ms` } as React.CSSProperties}
            >
              <CategoryChip name={cat.icon} tone={CAT_TONE[cat.id]} size="sm" />
              <span className="flex-1 min-w-0 font-bold text-[13px] text-gray-900 group-hover:text-blue-700 transition-colors leading-tight">{localized(cat)}</span>
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (stage === 'type') {
    return (
      <div className="apple-page-enter space-y-6">
        <BackBtn
          label={t('create.otherCatalog')}
          onClick={() => (needsTypeFirst ? setValue('catalogId', '') : setValue('categoryId', ''))}
        />
        <Header subtitle={t('create.typeTitle')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {catalogTypes.map((tp, ti) => {
            const meta = { emoji: TYPE_META[tp].emoji, label: t(`create.typeMeta.${tp}.label`), hint: t(`create.typeMeta.${tp}.hint`) };
            return (
              <button
                key={tp}
                type="button"
                onClick={() => ctl.chooseType(tp)}
                className="mega-parent-item apple-tap p-5 rounded-2xl border-2 border-gray-100 bg-white hover:border-blue-500 hover:shadow-lg transition-all text-left group flex items-start gap-4 cursor-pointer"
                style={{ '--mi': `${ti * 30}ms` } as React.CSSProperties}
              >
                <div className="text-2xl shrink-0">{meta.emoji}</div>
                <div className="min-w-0">
                  <span className="font-bold text-sm text-gray-900 block group-hover:text-blue-600 transition-colors">{meta.label}</span>
                  <span className="text-xs text-gray-500 mt-1 block leading-relaxed">{meta.hint}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (stage === 'subcat') {
    return (
      <div className="apple-page-enter space-y-6">
        <BackBtn label={t('create.otherType')} onClick={() => ctl.selectCategory(selectedCategoryObj?.parent_id || '')} />
        <Header subtitle={t('create.categoryTitle')} />
        {AiBanner}
        <div className="p-4 rounded-2xl bg-gray-50/70 border border-gray-100">
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-blue-600" /> {t('create.subcategory')} <span className="text-rose-500">*</span>
            </label>
            {selectedCategoryObj && <span className="text-[11px] font-semibold text-blue-600">{localized(selectedCategoryObj)}</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {subcategoriesOfParent.map((sub, si) => {
              const on = categoryId === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => ctl.selectCategory(sub.id)}
                  className={`th-chip-in apple-tap ${chipCls(on)}`}
                  style={{ '--ci': `${si * 18}ms` } as React.CSSProperties}
                >
                  {on && <Check className="w-3.5 h-3.5" />} <span>{localized(sub)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'ready') {
    return (
      <div className="apple-page-enter space-y-6">
        <Header subtitle={t('create.categoryTitle')} />
        {AiBanner}
        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex items-center gap-2.5 text-xs font-semibold text-emerald-800">
          <Check className="w-4 h-4" />
          <span>
            {selectedCatalog && localized(selectedCatalog)}
            {type && ` · ${t(`create.typeMeta.${type}.label`)}`}
            {selectedCategoryObj && ` · ${localized(selectedCategoryObj)}`}
          </span>
        </div>
        <p className="text-[11px] text-gray-500 text-center">{t('wizard.readyToNext')}</p>
      </div>
    );
  }

  // stage === 'category'
  return (
    <div className="apple-page-enter space-y-6">
      <BackBtn
        label={needsTypeFirst ? t('create.otherType') : t('create.otherCatalog')}
        onClick={() => (needsTypeFirst ? setValue('type', '') : setValue('catalogId', ''))}
      />
      <Header subtitle={t('create.categoryTitle')} />
      {AiBanner}
      {parentCategories.length === 0 ? (
        <div className="text-center text-xs text-gray-400 py-10">{t('create.categoriesLoading')}</div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white divide-y divide-gray-100 overflow-hidden">
          {parentCategories.map((c, ci) => (
            <button
              key={c.id}
              type="button"
              onClick={() => ctl.selectCategory(c.id)}
              className="mega-cat-item apple-tap w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-blue-50/60 active:bg-blue-50 transition-colors group cursor-pointer"
              style={{ '--mi': `${ci * 22}ms` } as React.CSSProperties}
            >
              <CategoryChip name={c.icon} tone={CAT_TONE[selectedCatalog!.id]} size="sm" />
              <span className="flex-1 min-w-0 font-bold text-[13px] text-gray-900 group-hover:text-blue-700 transition-colors leading-tight">{localized(c)}</span>
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategorySelector;

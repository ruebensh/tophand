// ============================================================================
//  StepAttributes — WIZARD Step 3 (Parametrlar / dinamik atributlar).
//  Asl DynamicFieldRenderer'dagi atribut mantiqi shu yerga ko'chirildi:
//  tashkilot tanlash + kategoriya atribut sxemasi (RHF Controller) + ustida AI
//  to'ldirish tugmasi + aiFilledKeys badge + qizil ko'rik eslatmasi + xizmatlar
//  afzalliklari (services) / ko'nikmalar (jobs autosuggest) + bandlik bloklari.
// ============================================================================

import React, { useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import {
  Sparkles, Wand2, TriangleAlert, Check, SlidersHorizontal, ShieldCheck, Tag,
} from 'lucide-react';
import type { CategoryAttribute, WorkFormat } from '../../types/index.ts';
import type { WizardFormValues } from '../../types/wizard.ts';
import { useWizardController } from './wizardContext.tsx';
import { INPUT_CLS, chipCls, FieldError, SelectAttrField, MultiselectAttrField } from './fields.tsx';
import { PRESET_FEATURES } from './wizardMeta.ts';
import AutosuggestInput from './AutosuggestInput.tsx';

// Bitta dinamik atribut maydoni — turiga qarab kontrol tanlanadi, RHF'ga bog'lanadi.
// `meta.depends_on` bo'lsa: ota-maydon qiymatiga qarab variantlar filtrlanadi
// (kaskad, masalan Brend→Model) va noto'g'ri tanlangan bola-qiymat tozalanadi.
const AttrField: React.FC<{ attr: CategoryAttribute }> = ({ attr }) => {
  const { t } = useWizardController();
  const { control, watch, getValues, setValue } = useFormContext<WizardFormValues>();

  const dependsOn = (attr.meta?.depends_on ?? null) as
    | { key?: string; map?: Record<string, string[]> }
    | null;
  const parentKey = dependsOn?.key || '';
  const parentVal = parentKey ? watch(`attributes.${parentKey}`) : undefined;

  // Ruxsat etilgan variantlar: ota tanlangan va map'da bor bo'lsa — subset,
  // aks holda barcha variantlar (ota bo'sh yoki map'da yo'q).
  const allowed =
    dependsOn?.map && parentVal != null && String(parentVal).trim() !== ''
      ? dependsOn.map[String(parentVal)]
      : undefined;
  const effectiveAttr: CategoryAttribute = Array.isArray(allowed)
    ? { ...attr, options: (attr.options || []).filter((o) => allowed.includes(o)) }
    : attr;

  // Ota o'zgarganda, bola qiymati endi ruxsat etilmagan bo'lsa — tozalaymiz.
  useEffect(() => {
    if (!parentKey || !dependsOn?.map) return;
    const a = dependsOn.map[String(parentVal ?? '')];
    if (!Array.isArray(a)) return;
    const cur = getValues(`attributes.${attr.key}` as any);
    if (cur != null && String(cur).trim() !== '' && !a.includes(String(cur))) {
      setValue(`attributes.${attr.key}` as any, undefined as any, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentKey, parentVal]);

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
            control_$ = <SelectAttrField attr={effectiveAttr} value={typeof val === 'string' ? val : ''} onChange={setAttr} />;
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
            control_$ = <MultiselectAttrField attr={effectiveAttr} value={typeof val === 'string' ? val : ''} onChange={setAttr} />;
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

const StepAttributes: React.FC = () => {
  const ctl = useWizardController();
  const { t, attrSchema, isJobs, isServices, showEmployment } = ctl;
  const { control, register, watch } = useFormContext<WizardFormValues>();

  const skills = watch('skills') || [];

  return (
    <div className="space-y-6">
      <div className="text-center max-w-lg mx-auto">
        <h2 className="text-lg font-black text-gray-900">{t('wizard.step.attributes')}</h2>
        <p className="text-xs text-gray-500 mt-1">{t('wizard.attributesHint')}</p>
      </div>

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
    </div>
  );
};

export default StepAttributes;

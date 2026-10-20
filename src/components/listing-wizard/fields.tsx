// ============================================================================
//  listing-wizard shared primitives — form control ko'rinishlari va yordamchi
//  klasslar. CreateListingPage'dagi asl mantiq saqlanadi (select+custom,
//  multiselect chiplar), lekin ular RHF Controller orqali bog'lanadi.
// ============================================================================

import React, { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/IntlContext.tsx';
import { Check, X } from 'lucide-react';
import type { CategoryAttribute } from '../../types/index.ts';

// Rang uchun standart variantlar (attribute.options bo'sh bo'lsa ishlatiladi).
export const COLOR_OPTIONS = [
  'Oq', 'Qora', 'Kulrang', 'Qizil', "Ko'k", 'Yashil', 'Sariq', 'Jigarrang', 'Binafsha', 'Rangli',
];

export const INPUT_CLS =
  'w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500';

export const chipCls = (on: boolean, tone = 'blue') =>
  `px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
    on
      ? 'bg-blue-600 text-white font-bold shadow-xs'
      : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-700'
  }${tone === 'emerald' && on ? '!bg-emerald-600' : ''}`;

// Inline xabar (zod triggers xatolari uchun).
export const FieldError: React.FC<{ message?: string }> = ({ message }) => {
  if (!message) return null;
  return <p className="mt-1 text-[11px] font-semibold text-rose-600">{message}</p>;
};

// select/color uchun maydon: ro'yxatdan tanlash + qo'lda (custom) qiymat kiritish.
export const SelectAttrField: React.FC<{
  attr: CategoryAttribute;
  value: string;
  onChange: (v: string | undefined) => void;
}> = ({ attr, value, onChange }) => {
  const { t } = useI18n();
  const opts = attr.options && attr.options.length ? attr.options : attr.type === 'color' ? COLOR_OPTIONS : [];
  const inList = !!value && opts.includes(value);
  const [draft, setDraft] = useState(value && !inList ? value : '');
  useEffect(() => {
    setDraft(value && !opts.includes(value) ? value : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="space-y-1.5">
      <select
        value={inList ? value : ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        className={INPUT_CLS}
      >
        <option value="">{attr.label} {t('create.selectParen')}</option>
        {opts.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
        {value && !inList && <option value={value}>{value} {t('create.manualParen')}</option>}
      </select>
      <input
        type="text"
        value={draft}
        onChange={(e) => { setDraft(e.target.value); onChange(e.target.value || undefined); }}
        placeholder={t('create.manualPlaceholder')}
        className={`${INPUT_CLS} !py-2 text-[11px]`}
      />
    </div>
  );
};

// multiselect uchun maydon: chiplar + o'z qiymatini qo'shish (custom).
// Qiymat vergul-bilan birlashtirilgan string sifatida saqlanadi (server JSONB).
export const MultiselectAttrField: React.FC<{
  attr: CategoryAttribute;
  value: string;
  onChange: (v: string | undefined) => void;
}> = ({ attr, value, onChange }) => {
  const { t } = useI18n();
  const known = attr.options || [];
  const arr = value ? value.split(', ').filter(Boolean) : [];
  const [draft, setDraft] = useState('');
  const toggle = (o: string) => {
    const next = arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o];
    onChange(next.length ? next.join(', ') : undefined);
  };
  const addCustom = () => {
    const v = draft.trim();
    if (!v || arr.includes(v)) { setDraft(''); return; }
    onChange([...arr, v].join(', '));
    setDraft('');
  };
  const customSelected = arr.filter((x) => !known.includes(x));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {known.map((o) => {
          const on = arr.includes(o);
          return (
            <button key={o} type="button" onClick={() => toggle(o)} className={chipCls(on)}>
              {on && <Check className="w-3.5 h-3.5" />}
              {o}
            </button>
          );
        })}
        {customSelected.map((x) => (
          <span key={x} className={chipCls(true)}>
            {x}
            <button type="button" onClick={() => toggle(x)} className="ml-0.5 hover:opacity-70">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
          placeholder={t('create.addOwnPlaceholder')}
          className={`${INPUT_CLS} !py-2 text-[11px]`}
        />
        <button type="button" onClick={addCustom} className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold shrink-0 cursor-pointer">
          {t('create.add')}
        </button>
      </div>
    </div>
  );
};

// Kategoriya brauzeri filtr boshqaruvlari — Avito uslubidagi keng filtrlar.
// Har bir komponent sof (presentational): qiymatni ichida saqlamaydi,
// faqat prop orqali qiymat oladi va o'zgarishni callback bilan xabar qiladi.

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/IntlContext.tsx';

// Umumiy kichik sarlavha (filtr guruhi ichidagi atribut nomi).
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[12px] text-[#5E6C84] font-semibold mb-1.5 block">{children}</span>;
}

// ── Range (od / do) — sonli oraliq + ixtiyoriy tezkor presets ───────────
export function RangeFilter({
  label,
  unit,
  from,
  to,
  meta,
  onChange,
}: {
  label: string;
  unit?: string | null;
  from: string;
  to: string;
  meta?: Record<string, any>;
  onChange: (from: string, to: string) => void;
}) {
  const { t, intlLocale } = useI18n();
  // Mahalliy kiritish holati — yozish paytida filtrlashni kechiktirish uchun
  // (onChange blur/Enter yoki preset bosilganda qiymatni yuboradi).
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);
  useEffect(() => setLocalFrom(from), [from]);
  useEffect(() => setLocalTo(to), [to]);

  const presets: [number, number][] = Array.isArray(meta?.presets) ? meta.presets : [];
  const digits = (v: string) => v.replace(/[^\d]/g, '');

  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}{unit ? ` (${unit})` : ''}</FieldLabel>
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map(([pmin, pmax], i) => {
            const active = String(pmin) === localFrom && String(pmax) === localTo;
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (active) { setLocalFrom(''); setLocalTo(''); onChange('', ''); }
                  else { setLocalFrom(String(pmin)); setLocalTo(String(pmax)); onChange(String(pmin), String(pmax)); }
                }}
                className={`text-[11px] px-2 py-1 rounded-lg border font-semibold transition-all ${
                  active ? 'bg-[#1673E6] text-white border-[#1673E6]' : 'bg-white text-gray-600 border-[#EBECF0] hover:border-[#1673E6] hover:text-[#1673E6]'
                }`}
              >
                {pmin.toLocaleString(intlLocale)}–{pmax.toLocaleString(intlLocale)}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="text" inputMode="numeric" placeholder={t('home.priceFromPh')} value={localFrom}
          onChange={(e) => setLocalFrom(digits(e.target.value))}
          onBlur={() => onChange(localFrom, localTo)}
          onKeyDown={(e) => { if (e.key === 'Enter') { onChange(localFrom, localTo); (e.target as HTMLInputElement).blur(); } }}
          className="w-full bg-white border border-[#EBECF0] rounded-xl px-3 py-2 text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] placeholder-gray-400"
        />
        <span className="text-gray-400 text-sm shrink-0">—</span>
        <input
          type="text" inputMode="numeric" placeholder={t('home.priceToPh')} value={localTo}
          onChange={(e) => setLocalTo(digits(e.target.value))}
          onBlur={() => onChange(localFrom, localTo)}
          onKeyDown={(e) => { if (e.key === 'Enter') { onChange(localFrom, localTo); (e.target as HTMLInputElement).blur(); } }}
          className="w-full bg-white border border-[#EBECF0] rounded-xl px-3 py-2 text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] placeholder-gray-400"
        />
      </div>
    </div>
  );
}

// ── Chips (toggle) — bir yoki ko'p tanlov ───────────────────────────────
export function ChipFilter({
  label,
  options,
  multiple,
  value,
  onChange,
  labelFor,
}: {
  label: string;
  options: string[];
  multiple: boolean;
  value: string; // multiple => vergul bilan ajratilgan; single => bitta qiymat
  onChange: (next: string) => void;
  labelFor?: (opt: string) => string; // qiymat o'zgarmaydi, faqat ko'rinish tarjimasi
}) {
  const display = labelFor ?? ((opt: string) => opt);
  const selected = new Set(multiple && value ? value.split(',').filter(Boolean) : value ? [value] : []);
  const toggle = (opt: string) => {
    if (!multiple) {
      onChange(value === opt ? '' : opt);
      return;
    }
    const set = new Set(selected);
    if (set.has(opt)) set.delete(opt); else set.add(opt);
    onChange(Array.from(set).join(','));
  };
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const active = selected.has(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`text-[11px] px-2.5 py-1.5 rounded-lg border font-medium transition-all ${
                active ? 'bg-[#1673E6] text-white border-[#1673E6] shadow-2xs' : 'bg-white text-gray-600 border-[#EBECF0] hover:border-[#1673E6] hover:text-[#1673E6]'
              }`}
            >
              {display(opt)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Checkbox guruhi — uzun ko'p tanlov ro'yxatlari uchun ────────────────
export function CheckboxFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  const selected = new Set(value ? value.split(',').filter(Boolean) : []);
  const toggle = (opt: string) => {
    const set = new Set(selected);
    if (set.has(opt)) set.delete(opt); else set.add(opt);
    onChange(Array.from(set).join(','));
  };
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => {
          const checked = selected.has(opt);
          return (
            <label key={opt} className="flex items-center gap-2.5 text-xs text-[#172B4D] cursor-pointer hover:text-[#1673E6] transition-colors">
              <input
                type="checkbox" checked={checked} onChange={() => toggle(opt)}
                className="w-3.5 h-3.5 rounded text-[#1673E6] border-[#EBECF0] accent-[#1673E6]"
              />
              <span className={checked ? 'font-semibold text-[#1673E6]' : ''}>{opt}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── Select — uzun ro'yxatlar (uzun brendlar, ekran va h.k.) ─────────────
export function SelectFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useI18n();
  return (
    <label className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-[#EBECF0] rounded-xl px-3 py-2 text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] cursor-pointer"
      >
        <option value="">{t('home.notSet')}</option>
        {options.map((o) => (<option key={o} value={o}>{o}</option>))}
      </select>
    </label>
  );
}

// ── Boolean — Farq qilmaydi / Ha / Yo'q ─────────────────────────────────
export function BooleanFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useI18n();
  return (
    <label className="flex flex-col gap-1">
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-white border border-[#EBECF0] rounded-xl px-3 py-2 text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] cursor-pointer"
      >
        <option value="">{t('home.anyMatters')}</option>
        <option value="true">{t('common.yes')}</option>
        <option value="false">{t('common.no')}</option>
      </select>
    </label>
  );
}

// ── Text / son (yagona kiritish) ────────────────────────────────────────
export function TextFilter({
  label,
  unit,
  numeric,
  value,
  onChange,
}: {
  label: string;
  unit?: string | null;
  numeric?: boolean;
  value: string;
  onChange: (next: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <label className="flex flex-col gap-1">
      <FieldLabel>{label}{unit ? ` (${unit})` : ''}</FieldLabel>
      <input
        type="text"
        inputMode={numeric ? 'numeric' : 'text'}
        value={local}
        onChange={(e) => setLocal(numeric ? e.target.value.replace(/[^\d]/g, '') : e.target.value)}
        onBlur={() => onChange(local)}
        onKeyDown={(e) => { if (e.key === 'Enter') { onChange(local); (e.target as HTMLInputElement).blur(); } }}
        placeholder={label}
        className="w-full bg-white border border-[#EBECF0] rounded-xl px-3 py-2 text-xs font-medium text-[#172B4D] focus:outline-hidden focus:border-[#1673E6] placeholder-gray-400"
      />
    </label>
  );
}

// Gorizontal skroll strip uchun sichqoncha g'ildiragi normallashtirgichi
// (catalog/category gridlar bilan bir xil xatti-harakat).
export function useHorizontalWheel(ref: React.RefObject<HTMLDivElement | null>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 0) return;
    const onWheel = (e: WheelEvent) => {
      const raw = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (raw === 0) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? el.clientWidth : 1;
      el.scrollLeft += raw * unit * 1;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref, enabled]);
}

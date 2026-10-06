// "Top mashxur" qatori — toolbar ostida. Kategoriyaga mos mashxur atribut
// qiymatlari (curate tartib + jonli sonlar). Bo'sh bo'lsa reklama sloti chiqadi.
//
// Mobil/responsiv qatori qoidasi:
//   - 10 tadan kam bo'lsa  → 1 qator, gorizontal siljiydigan;
//   - 10 va undan ortiq    → 2 qator (birinchi yarim 1-qator, qolgani 2-qator),
//                            har bir qator gorizontal siljiydigan.

import { useEffect, useRef, useState } from 'react';
import { getCategoryPopular, CategoryPopularResult } from '../../lib/api.ts';
import { CategoryAdSlot } from './CategoryAdSlot.tsx';
import { useHorizontalWheel } from './FilterControls.tsx';
import { useI18n } from '../../i18n/IntlContext.tsx';

type PopularItem = CategoryPopularResult['items'][number];

/** Bitta gorizontal siljiydigan mashxur qatori. */
function ChipRow({
  items,
  active,
  onToggle,
}: {
  items: PopularItem[];
  active: string;
  onToggle: (value: string) => void;
}) {
  const { intlLocale } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  useHorizontalWheel(ref, items.length > 0);

  return (
    <div
      ref={ref}
      className="no-scrollbar flex gap-1.5 overflow-x-auto scroll-smooth pb-1"
    >
      {items.map((it) => {
        const isActive = active === it.value;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onToggle(it.value)}
            className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              isActive
                ? 'bg-[#1673E6] text-white border-[#1673E6] shadow-2xs'
                : 'bg-white text-[#172B4D] border-[#EBECF0] hover:border-[#1673E6] hover:text-[#1673E6]'
            }`}
          >
            {it.value}
            <span className={`ml-1.5 tabular-nums ${isActive ? 'text-white/70' : 'text-[#5E6C84]'}`}>
              {it.count.toLocaleString(intlLocale)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function PopularRow({
  categoryId,
  categoryTitle,
  attrFilters,
  onToggle,
}: {
  categoryId: string;
  categoryTitle?: string;
  attrFilters: Record<string, string | number>;
  onToggle: (key: string, value: string) => void;
}) {
  const { t } = useI18n();
  const [data, setData] = useState<CategoryPopularResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setData(null);
    getCategoryPopular(categoryId)
      .then((res) => { if (alive) setData(res); })
      .catch(() => { if (alive) setData({ key: null, label: '', items: [] }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [categoryId]);

  if (loading) {
    return (
      <div className="flex gap-2 overflow-hidden mb-5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-9 w-24 shrink-0 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const key = data?.key;
  const items = data?.items ?? [];

  // Mashxur atribut sozlanmagan yoki qiymat yo'q => reklama sloti.
  if (!key || items.length === 0) {
    return <div className="mb-5"><CategoryAdSlot title={categoryTitle} /></div>;
  }

  const active = String(attrFilters[key] ?? '');

  // 10 tadan ortiq (yoki teng) bo'lsa — 2 qatorga teng bo'lamiz (row-first).
  const rows: PopularItem[][] =
    items.length >= 10
      ? [items.slice(0, Math.ceil(items.length / 2)), items.slice(Math.ceil(items.length / 2))]
      : [items];

  return (
    <div className="mb-5">
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[#5E6C84] font-semibold">
          {t('home.popularWord')}{data?.label ? ` — ${data.label.toLowerCase()}` : ''}
        </span>
        {active && (
          <button
            type="button"
            onClick={() => onToggle(key, '')}
            className="text-[11px] font-semibold text-[#1673E6] hover:underline cursor-pointer"
          >
            {t('common.clear')}
          </button>
        )}
      </div>
      <div className={rows.length > 1 ? 'space-y-1.5' : ''}>
        {rows.map((row, i) => (
          <ChipRow
            key={i}
            items={row}
            active={active}
            onToggle={(value) => onToggle(key, active === value ? '' : value)}
          />
        ))}
      </div>
    </div>
  );
}

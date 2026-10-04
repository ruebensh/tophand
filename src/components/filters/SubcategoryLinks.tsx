// Subkategoriyalar — oddiy matn, lekin havolali (oxirgi skrinshot uslubi).
// Filtr paneli tepasida joylashadi; tanlanganda kategoriya konteksti o'zgaradi
// va qolgan filtrlar shu subkategoriyaga moslashadi (attrSchema qayta yuklanadi).

import { Category } from '../../types/index.ts';

export function SubcategoryLinks({
  parent,
  subs,
  activeId,
  onSelect,
}: {
  parent: Category;
  subs: Category[];
  activeId: string | undefined;
  onSelect: (id: string) => void;
}) {
  if (!subs || subs.length === 0) return null;
  const isParentActive = !activeId || activeId === parent.id;

  return (
    <div className="mb-5">
      <span className="font-mono text-[11px] uppercase tracking-wider text-[#5E6C84] font-semibold mb-2 block">
        Yo‘nalishlar
      </span>
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => onSelect(parent.id)}
          className={`self-start text-left text-[13px] leading-snug transition-colors cursor-pointer ${
            isParentActive ? 'text-[#1673E6] font-semibold' : 'text-[#5E6C84] hover:text-[#1673E6]'
          }`}
        >
          {parent.name_uz} (barchasi)
        </button>
        {subs.map((sub) => {
          const active = activeId === sub.id;
          return (
            <button
              key={sub.id}
              type="button"
              onClick={() => onSelect(sub.id)}
              className={`self-start text-left text-[13px] leading-snug transition-colors cursor-pointer ${
                active ? 'text-[#1673E6] font-semibold' : 'text-[#5E6C84] hover:text-[#1673E6]'
              }`}
            >
              {sub.name_uz}
            </button>
          );
        })}
      </div>
    </div>
  );
}

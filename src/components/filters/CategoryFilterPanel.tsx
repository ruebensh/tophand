// Kategoriya filtr paneli — atribut sxemasini (`attrSchema`) bo'limlarga (section)
// guruhlab, har bir tur uchun mos boshqaruvni render qiladi. Qiymatlar `attrFilters`
// ichida saqlanadi:
//   - select/chips/bir tanlov, rang, bool, text  →  attrFilters[key]
//   - multiselect chips/checkbox                 →  attrFilters[key] = "a,b,c"
//   - range (od/do)                              →  attrFilters[key_from], [key_to]
// Backend (`listingService.searchListings`) shu shakllarni tushunadi.

import { CategoryAttribute } from '../../types/index.ts';
import {
  RangeFilter, ChipFilter, CheckboxFilter, SelectFilter, BooleanFilter, TextFilter,
} from './FilterControls.tsx';

type Setter = React.Dispatch<React.SetStateAction<Record<string, string | number>>>;

const COLOR_PALETTE = [
  'Qora', 'Oq', 'Kul', 'Qizil', 'Ko’k', 'Yashil', 'Sariq', 'To’q sariq', 'Jigarrang', 'Pushti',
];

function patch(setAttrFilters: Setter, updates: Record<string, string | number | undefined | ''>) {
  setAttrFilters((prev) => {
    const next = { ...prev };
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined || v === null || v === '') delete next[k];
      else next[k] = v;
    }
    return next;
  });
}

function resolveControl(attr: CategoryAttribute): 'range' | 'chipsSingle' | 'chipsMulti' | 'checkbox' | 'select' | 'bool' | 'text' | 'number' {
  const forced = (attr.meta?.control as string) || '';
  if (forced) return forced as any;
  const n = (attr.options || []).length;
  switch (attr.type) {
    case 'range':
    case 'year':
      return 'range';
    case 'number':
      // Chegaralar berilgan bo'lsa oraliq, aks holda yagona son kiritish.
      return attr.meta && (attr.meta.min !== undefined || attr.meta.max !== undefined) ? 'range' : 'number';
    case 'bool':
      return 'bool';
    case 'multiselect':
      return n > 8 ? 'checkbox' : 'chipsMulti';
    case 'color':
      return 'chipsSingle';
    case 'select':
      return n > 0 && n <= 6 ? 'chipsSingle' : 'select';
    case 'text':
    default:
      return 'text';
  }
}

export function CategoryFilterPanel({
  attrSchema,
  attrFilters,
  setAttrFilters,
}: {
  attrSchema: CategoryAttribute[];
  attrFilters: Record<string, string | number>;
  setAttrFilters: Setter;
}) {
  if (!attrSchema || attrSchema.length === 0) return null;

  // Bo'limlarni birinchi paydo bo'lish tartibida guruhlaymiz (attrSchema sort_order bo'yicha).
  const groups: { name: string; attrs: CategoryAttribute[] }[] = [];
  const byName = new Map<string, CategoryAttribute[]>();
  for (const a of attrSchema) {
    const name = a.section || 'Asosiy';
    if (!byName.has(name)) { const arr: CategoryAttribute[] = []; byName.set(name, arr); groups.push({ name, attrs: arr }); }
    byName.get(name)!.push(a);
  }

  const val = (key: string) => String(attrFilters[key] ?? '');

  const renderAttr = (attr: CategoryAttribute) => {
    const control = resolveControl(attr);
    const label = attr.label;
    const options = (attr.options && attr.options.length > 0)
      ? attr.options
      : (attr.type === 'color' ? COLOR_PALETTE : []);

    if (control === 'range') {
      return (
        <RangeFilter
          key={attr.id} label={label} unit={attr.unit} meta={attr.meta}
          from={String(attrFilters[`${attr.key}_from`] ?? '')}
          to={String(attrFilters[`${attr.key}_to`] ?? '')}
          onChange={(from, to) => patch(setAttrFilters, { [`${attr.key}_from`]: from, [`${attr.key}_to`]: to })}
        />
      );
    }
    if (control === 'chipsSingle') {
      return <ChipFilter key={attr.id} label={label} options={options} multiple={false} value={val(attr.key)} onChange={(next) => patch(setAttrFilters, { [attr.key]: next })} />;
    }
    if (control === 'chipsMulti') {
      return <ChipFilter key={attr.id} label={label} options={options} multiple value={val(attr.key)} onChange={(next) => patch(setAttrFilters, { [attr.key]: next })} />;
    }
    if (control === 'checkbox') {
      return <CheckboxFilter key={attr.id} label={label} options={options} value={val(attr.key)} onChange={(next) => patch(setAttrFilters, { [attr.key]: next })} />;
    }
    if (control === 'select') {
      return <SelectFilter key={attr.id} label={label} options={options} value={val(attr.key)} onChange={(next) => patch(setAttrFilters, { [attr.key]: next })} />;
    }
    if (control === 'bool') {
      return <BooleanFilter key={attr.id} label={label} value={val(attr.key)} onChange={(next) => patch(setAttrFilters, { [attr.key]: next })} />;
    }
    if (control === 'number') {
      return <TextFilter key={attr.id} label={label} unit={attr.unit} numeric value={val(attr.key)} onChange={(next) => patch(setAttrFilters, { [attr.key]: next })} />;
    }
    return <TextFilter key={attr.id} label={label} value={val(attr.key)} onChange={(next) => patch(setAttrFilters, { [attr.key]: next })} />;
  };

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.name}>
          <span className="font-mono text-[11px] uppercase tracking-wider text-[#5E6C84] font-semibold mb-2.5 block">
            {g.name}
          </span>
          <div className="flex flex-col gap-3">
            {g.attrs.map(renderAttr)}
          </div>
        </div>
      ))}
    </div>
  );
}

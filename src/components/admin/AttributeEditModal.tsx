import React, { useState, useEffect } from 'react';
import { X, Save, Filter } from 'lucide-react';
import type { CategoryAttribute, AttributeType } from '../../types/index.ts';

const TYPE_OPTIONS: { value: AttributeType; label: string }[] = [
  { value: 'select', label: 'Tanlash (bir qiymat)' },
  { value: 'multiselect', label: 'Bir nechta tanlash' },
  { value: 'range', label: 'Oraliq (dan – gacha)' },
  { value: 'number', label: 'Raqam' },
  { value: 'year', label: 'Yil oralig’i' },
  { value: 'text', label: 'Matn' },
  { value: 'bool', label: 'Ha / Yo‘q (belgi)' },
  { value: 'color', label: 'Rang' },
];

const SECTION_SUGGESTIONS = ['Asosiy', 'Texnik', 'Holat', 'Qo’shimcha', 'O‘lcham', 'Yetkazib berish'];
const CONTROL_SUGGESTIONS = ['range', 'number', 'chipsSingle', 'chipsMulti', 'checkbox', 'select', 'bool', 'color', 'text'];

// select / multiselect uchun variantalar maydoni kerak
const usesOptions = (t: AttributeType) => t === 'select' || t === 'multiselect';
// range / number / year uchun son meta maydonlari kerak
const usesNumericMeta = (t: AttributeType) => t === 'range' || t === 'number' || t === 'year';

interface AttributeEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryLabel: string;
  attribute: CategoryAttribute | null; // null => yangi
  onSave: (payload: any, existingId?: string) => Promise<void>;
}

export const AttributeEditModal: React.FC<AttributeEditModalProps> = ({
  isOpen,
  onClose,
  categoryLabel,
  attribute,
  onSave,
}) => {
  const isEditing = Boolean(attribute?.id);

  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<AttributeType>('select');
  const [optionsText, setOptionsText] = useState('');
  const [unit, setUnit] = useState('');
  const [section, setSection] = useState('Asosiy');
  const [required, setRequired] = useState(false);
  const [filterable, setFilterable] = useState(true);
  const [sortOrder, setSortOrder] = useState(0);
  const [isPopular, setIsPopular] = useState(false);
  const [popularOrder, setPopularOrder] = useState(0);
  const [popularValuesText, setPopularValuesText] = useState('');
  // meta — butun obyektni saqlab qolamiz, faqat tanilgan ost-maydonlarni tahrirlaymiz
  const [metaRest, setMetaRest] = useState<Record<string, any>>({});
  const [metaMin, setMetaMin] = useState('');
  const [metaMax, setMetaMax] = useState('');
  const [metaStep, setMetaStep] = useState('');
  const [metaControl, setMetaControl] = useState('');
  const [metaPlaceholder, setMetaPlaceholder] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (attribute) {
      setKey(attribute.key || '');
      setLabel(attribute.label || '');
      setType(attribute.type || 'select');
      setOptionsText((attribute.options || []).join('\n'));
      setUnit(attribute.unit || '');
      setSection(attribute.section || 'Asosiy');
      setRequired(Boolean(attribute.required));
      setFilterable(attribute.filterable !== false);
      setSortOrder(Number(attribute.sort_order) || 0);
      setIsPopular(Boolean(attribute.is_popular));
      setPopularOrder(Number(attribute.popular_order) || 0);
      setPopularValuesText((attribute.popular_values || []).join('\n'));
      const m = { ...(attribute.meta || {}) };
      setMetaMin(m.min !== undefined ? String(m.min) : '');
      setMetaMax(m.max !== undefined ? String(m.max) : '');
      setMetaStep(m.step !== undefined ? String(m.step) : '');
      setMetaControl(m.control !== undefined ? String(m.control) : '');
      setMetaPlaceholder(m.placeholder !== undefined ? String(m.placeholder) : '');
      const { min, max, step, control, placeholder, ...rest } = m;
      void min; void max; void step; void control; void placeholder;
      setMetaRest(rest);
    } else {
      setKey('');
      setLabel('');
      setType('select');
      setOptionsText('');
      setUnit('');
      setSection('Asosiy');
      setRequired(false);
      setFilterable(true);
      setSortOrder(0);
      setIsPopular(false);
      setPopularOrder(0);
      setPopularValuesText('');
      setMetaRest({});
      setMetaMin(''); setMetaMax(''); setMetaStep(''); setMetaControl(''); setMetaPlaceholder('');
    }
  }, [attribute, isOpen]);

  if (!isOpen) return null;

  const parseLines = (t: string): string[] =>
    t.split('\n').map((s) => s.trim()).filter(Boolean);

  const buildMeta = (): Record<string, any> => {
    const meta: Record<string, any> = { ...metaRest };
    const putNum = (k: string, v: string) => {
      if (v.trim() !== '' && !Number.isNaN(Number(v))) meta[k] = Number(v);
      else delete meta[k];
    };
    if (usesNumericMeta(type)) {
      putNum('min', metaMin);
      putNum('max', metaMax);
      putNum('step', metaStep);
    }
    if (metaControl.trim()) meta.control = metaControl.trim();
    else delete meta.control;
    if (metaPlaceholder.trim()) meta.placeholder = metaPlaceholder.trim();
    else delete meta.placeholder;
    return meta;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) { alert('Filtr kaliti (key) kiritilishi shart'); return; }
    if (!label.trim()) { alert('Filtr nomi (label) kiritilishi shart'); return; }
    if (usesOptions(type) && parseLines(optionsText).length === 0) {
      alert('Bu filtr turi uchun kamida bitta variant kiriting'); return;
    }

    const payload: any = {
      key: key.trim(),
      label: label.trim(),
      type,
      options: usesOptions(type) ? parseLines(optionsText) : [],
      unit: unit.trim(),
      section: section.trim() || 'Asosiy',
      required,
      filterable,
      sort_order: sortOrder,
      is_popular: isPopular,
      popular_order: isPopular ? popularOrder : 0,
      popular_values: isPopular ? parseLines(popularValuesText) : [],
      meta: buildMeta(),
    };

    setIsSubmitting(true);
    try {
      await onSave(payload, attribute?.id);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Saqlashda xatolik');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls = 'w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:outline-hidden focus:border-blue-600';
  const labelCls = 'font-bold text-gray-700 block mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/60 backdrop-blur-xs">
      <div
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-indigo-50/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-gray-950">
                {isEditing ? 'Filtrni tahrirlash' : 'Yangi filtr qo‘shish'}
              </h3>
              <p className="text-xs text-gray-500 truncate max-w-[280px]">{categoryLabel}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-white/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Kalit (key) <span className="text-rose-500">*</span></label>
              <input
                type="text" value={key}
                onChange={(e) => setKey(e.target.value)}
                className={inputCls + ' font-mono'}
                placeholder="masalan: marka"
              />
              <p className="text-[10px] text-gray-400 mt-1">Faqat a-z, 0-9, _ (ichki identifikator)</p>
            </div>
            <div>
              <label className={labelCls}>Ko‘rinadigan nom (label) <span className="text-rose-500">*</span></label>
              <input
                type="text" value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={inputCls}
                placeholder="Masalan: Marka"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Filtr turi</label>
              <select value={type} onChange={(e) => setType(e.target.value as AttributeType)} className={inputCls}>
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Bo‘lim (section)</label>
              <input
                type="text" value={section} list="section-suggestions"
                onChange={(e) => setSection(e.target.value)}
                className={inputCls} placeholder="Asosiy"
              />
              <datalist id="section-suggestions">
                {SECTION_SUGGESTIONS.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
          </div>

          {usesOptions(type) && (
            <div>
              <label className={labelCls}>Variantlar (har bir qatorga bittadan)</label>
              <textarea
                rows={5} value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                className={inputCls + ' font-mono resize-y'}
                placeholder={'Chevrolet\nHyundai\nKia'}
              />
            </div>
          )}

          {usesNumericMeta(type) && (
            <div>
              <label className={labelCls}>Son oralig’i sozlamalari</label>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" value={metaMin} onChange={(e) => setMetaMin(e.target.value)} className={inputCls} placeholder="min" />
                <input type="number" value={metaMax} onChange={(e) => setMetaMax(e.target.value)} className={inputCls} placeholder="max" />
                <input type="number" value={metaStep} onChange={(e) => setMetaStep(e.target.value)} className={inputCls} placeholder="step" />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Bo‘sh qoldirsangiz avtomatik chegaralar ishlatiladi.</p>
            </div>
          )}

          {(type === 'number' || type === 'range' || type === 'year') && (
            <div>
              <label className={labelCls}>O‘lchov birligi (unit)</label>
              <input type="text" value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} placeholder="km, m², yil, GB…" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>UI control (ixtiyoriy)</label>
              <input
                type="text" value={metaControl} list="control-suggestions"
                onChange={(e) => setMetaControl(e.target.value)}
                className={inputCls + ' font-mono'} placeholder="auto"
              />
              <datalist id="control-suggestions">
                {CONTROL_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className={labelCls}>Placeholder (ixtiyoriy)</label>
              <input type="text" value={metaPlaceholder} onChange={(e) => setMetaPlaceholder(e.target.value)} className={inputCls} placeholder="Matn kiriting…" />
            </div>
          </div>

          {/* Flags */}
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="w-4 h-4 accent-blue-600" />
              <span className="font-semibold text-gray-700">Majburiy (required)</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50">
              <input type="checkbox" checked={filterable} onChange={(e) => setFilterable(e.target.checked)} className="w-4 h-4 accent-blue-600" />
              <span className="font-semibold text-gray-700">Filtrlarda ko‘rsatilsin</span>
            </label>
          </div>

          {/* Popular */}
          <div className="p-3 rounded-xl border border-gray-200 bg-gray-50/50 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isPopular} onChange={(e) => setIsPopular(e.target.checked)} className="w-4 h-4 accent-blue-600" />
              <span className="font-bold text-gray-700">“Top mashxur” qatorida ko‘rsatish</span>
            </label>
            {isPopular && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className={labelCls}>Tartib</label>
                    <input type="number" value={popularOrder} onChange={(e) => setPopularOrder(Number(e.target.value))} className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Mashxur qiymatlar (qatorlar)</label>
                    <textarea rows={2} value={popularValuesText} onChange={(e) => setPopularValuesText(e.target.value)} className={inputCls + ' font-mono resize-y'} placeholder={'Chevrolet\nHyundai'} />
                  </div>
                </div>
              </>
            )}
          </div>

          <div>
            <label className={labelCls}>Tartib raqami (sort_order)</label>
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className={inputCls} />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 font-semibold hover:bg-gray-50 cursor-pointer">
              Bekor qilish
            </button>
            <button type="submit" disabled={isSubmitting} className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors disabled:opacity-60">
              <Save className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saqlanmoqda…' : isEditing ? 'Saqlash' : 'Qo‘shish'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

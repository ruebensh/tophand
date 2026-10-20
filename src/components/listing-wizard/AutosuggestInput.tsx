// ============================================================================
//  AutosuggestInput — ko'nikmalar (skills) uchun generic autosuggest.
//  300ms debounce bilan /api/skills?q= so'raydi, standart teglarni dropdown'da
//  ko'rsatadi, tanlash chip bo'ladi. Topilmasa Enter/vergul orqali custom qo'shish.
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { X, Plus } from 'lucide-react';
import { getSkills, type SkillSuggestion } from '../../lib/api.ts';
import { useWizardController } from './wizardContext.tsx';
import { INPUT_CLS } from './fields.tsx';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

const AutosuggestInput: React.FC<Props> = ({ value, onChange, placeholder }) => {
  const { t } = useWizardController();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SkillSuggestion[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 300ms debounce — o'zgarganda /api/skills so'rovini kechiktirib yuboradi.
  useEffect(() => {
    const q = query.trim();
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await getSkills(q, 10);
        if (!cancelled) setResults(Array.isArray(res) ? res : []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  // Tashqi bosishda dropdown'ni yopish.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const selected = new Set(value.map((v) => v.toLowerCase()));
  const add = (raw: string) => {
    const name = raw.trim().replace(/,+$/, '').trim();
    if (!name || selected.has(name.toLowerCase())) { setQuery(''); return; }
    onChange([...value, name]);
    setQuery('');
  };
  const remove = (name: string) => onChange(value.filter((v) => v !== name));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(query);
    } else if (e.key === 'Backspace' && !query && value.length) {
      remove(value[value.length - 1]);
    }
  };

  const filtered = results.filter((r) => !selected.has(r.name.toLowerCase()));

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((v) => (
            <span key={v} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white flex items-center gap-1.5">
              {v}
              <button type="button" onClick={() => remove(v)} className="hover:opacity-70 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div ref={wrapRef} className="relative">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder || t('wizard.skillsPlaceholder')}
            className={`${INPUT_CLS}`}
          />
          <button
            type="button"
            onClick={() => add(query)}
            disabled={!query.trim()}
            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[11px] font-bold shrink-0 cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> {t('wizard.skillsAdd')}
          </button>
        </div>

        {open && (query.trim().length > 0 || loading) && (
          <div className="absolute z-20 left-0 right-0 mt-1 max-h-52 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg">
            {loading && results.length === 0 && (
              <div className="px-3 py-2 text-[11px] text-gray-400">{t('create.categoriesLoading')}</div>
            )}
            {!loading && filtered.length === 0 && query.trim() && (
              <button
                type="button"
                onClick={() => add(query)}
                className="w-full text-left px-3 py-2 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> {t('wizard.skillsAddCustom', { name: query.trim() })}
              </button>
            )}
            {filtered.map((r) => (
              <button
                key={r.name}
                type="button"
                onClick={() => add(r.name)}
                className="w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 cursor-pointer flex items-center justify-between gap-2"
              >
                <span>{r.name}</span>
                {r.category_hint && <span className="text-[10px] text-gray-400">{r.category_hint}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="text-[11px] text-gray-500">{t('wizard.skillsHint')}</p>
    </div>
  );
};

export default AutosuggestInput;

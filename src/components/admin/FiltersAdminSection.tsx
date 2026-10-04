import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiRequest, getCatalogs, getCategoryTree } from '../../lib/api.ts';
import { AttributeEditModal } from './AttributeEditModal.tsx';
import { CategoryChip } from '../common/CategoryIcon.tsx';
import type { Catalog, Category, CategoryAttribute } from '../../types/index.ts';
import {
  Plus, Trash2, Pencil, ChevronUp, ChevronDown, Loader2, Filter,
  ArrowLeftRight, Star, RefreshCw, Search,
} from 'lucide-react';

const CAT_TONE: Record<string, string> = {
  transport: 'blue', realty: 'amber', jobs: 'violet', services: 'teal',
  personal: 'rose', 'home-dacha': 'orange', parts: 'cyan', electronics: 'indigo',
  hobby: 'lime', animals: 'emerald', business: 'sky', business360: 'fuchsia', handmade: 'red',
};

const TYPE_BADGE: Record<string, string> = {
  select: 'Tanlash', multiselect: 'Ko‘p tanlash', range: 'Oraliq', number: 'Raqam',
  year: 'Yil', text: 'Matn', bool: 'Ha/Yo‘q', color: 'Rang',
};

// Bir kategoriya (ota yoki sub) tanlanganda query qilinadigan obyekt
interface Node {
  id: string;
  name_uz: string;
  catalog_id: string;
  isSub: boolean;
  parentName?: string;
  icon?: string;
}

export const FiltersAdminSection: React.FC = () => {
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [tree, setTree] = useState<any[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);

  const [activeCatalog, setActiveCatalog] = useState<string>('');
  const [nodeSearch, setNodeSearch] = useState('');
  const [selected, setSelected] = useState<Node | null>(null);

  const [attrs, setAttrs] = useState<CategoryAttribute[]>([]);
  const [loadingAttrs, setLoadingAttrs] = useState(false);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryAttribute | null>(null);

  // ─── Tree + catalogs load ────────────────────────────────────────────
  const loadTree = useCallback(async () => {
    setLoadingTree(true);
    try {
      const [cats, t] = await Promise.all([getCatalogs(), getCategoryTree()]);
      setCatalogs(Array.isArray(cats) ? cats : []);
      setTree(Array.isArray(t) ? t : []);
      if (cats?.length && !activeCatalog) setActiveCatalog(cats[0].id);
    } catch (err: any) {
      alert(err.message || 'Katalog/kategoriyalar yuklanmadi');
    } finally {
      setLoadingTree(false);
    }
  }, [activeCatalog]);

  useEffect(() => { loadTree(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Attributes load on node selection ───────────────────────────────
  const loadAttrs = useCallback(async (node: Node) => {
    setLoadingAttrs(true);
    try {
      const data = await apiRequest<CategoryAttribute[]>(
        `/api/admin/categories/${encodeURIComponent(node.id)}/attributes`
      );
      setAttrs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      alert(err.message || 'Filtrlar yuklanmadi');
      setAttrs([]);
    } finally {
      setLoadingAttrs(false);
    }
  }, []);

  useEffect(() => {
    if (selected) loadAttrs(selected);
    else setAttrs([]);
  }, [selected, loadAttrs]);

  // ─── Catalog → visible nodes (parents + their subs, flattened list) ──
  const catalogNodes = useMemo(() => {
    const q = nodeSearch.trim().toLowerCase();
    const parents = tree.filter((p) => (p.catalog_id || 'services') === activeCatalog);
    const out: Node[] = [];
    for (const p of parents) {
      const pn: Node = { id: p.id, name_uz: p.name_uz, catalog_id: activeCatalog, isSub: false, icon: p.icon };
      const subs: Node[] = (p.subs || []).map((s: any): Node => ({
        id: s.id, name_uz: s.name_uz, catalog_id: activeCatalog, isSub: true, parentName: p.name_uz, icon: s.icon,
      }));
      if (!q || p.name_uz?.toLowerCase().includes(q) || subs.some((s) => s.name_uz?.toLowerCase().includes(q))) {
        out.push(pn);
        if (!q || p.name_uz?.toLowerCase().includes(q)) out.push(...subs);
        else out.push(...subs.filter((s) => s.name_uz?.toLowerCase().includes(q)));
      }
    }
    return out;
  }, [tree, activeCatalog, nodeSearch]);

  // ─── Group attrs by section (preserve sort_order within section) ─────
  const grouped = useMemo(() => {
    const map: Record<string, CategoryAttribute[]> = {};
    for (const a of attrs) {
      const sec = a.section || 'Asosiy';
      (map[sec] = map[sec] || []).push(a);
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [attrs]);

  // ─── CRUD ────────────────────────────────────────────────────────────
  const handleSave = async (payload: any, existingId?: string) => {
    setSaving(true);
    try {
      if (existingId) {
        await apiRequest(`/api/admin/attributes/${encodeURIComponent(existingId)}`, {
          method: 'PUT', body: JSON.stringify(payload),
        });
      } else {
        await apiRequest(`/api/admin/categories/${encodeURIComponent(selected!.id)}/attributes`, {
          method: 'POST', body: JSON.stringify(payload),
        });
      }
      await loadAttrs(selected!);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (a: CategoryAttribute) => {
    if (!confirm(`“${a.label}” filtri o‘chirilsinmi?`)) return;
    setSaving(true);
    try {
      await apiRequest(`/api/admin/attributes/${encodeURIComponent(a.id)}`, { method: 'DELETE' });
      setAttrs((prev) => prev.filter((x) => x.id !== a.id));
    } catch (err: any) {
      alert(err.message || 'O‘chirishda xatolik');
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (a: CategoryAttribute) => { setEditing(a); setModalOpen(true); };

  // Reorder: swap position within full ordered list, then persist sort_order via reorder endpoint.
  const move = (id: string, dir: -1 | 1) => {
    const idx = attrs.findIndex((a) => a.id === id);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= attrs.length) return;
    const next = [...attrs];
    [next[idx], next[to]] = [next[to], next[idx]];
    setAttrs(next);
    persistOrder(next);
  };

  const persistOrder = async (ordered: CategoryAttribute[]) => {
    setSaving(true);
    try {
      const order = ordered.map((a, i) => { a.sort_order = i; return a.id; });
      await apiRequest(`/api/admin/categories/${encodeURIComponent(selected!.id)}/attributes/reorder`, {
        method: 'POST', body: JSON.stringify({ order }),
      });
    } catch (err: any) {
      alert(err.message || 'Tartib saqlanmadi');
      if (selected) loadAttrs(selected);
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
      {/* LEFT: picker */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs flex flex-col overflow-hidden lg:h-[calc(100vh-190px)]">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-extrabold text-sm text-gray-950 flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" /> Kategoriya filtrlari
          </h3>
          <p className="text-[11px] text-gray-500 mt-0.5">Katalog → kategoriya → subkategoriya tanlang</p>
        </div>

        {/* catalog chips */}
        <div className="px-3 pt-3 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto no-scrollbar">
          {catalogs.map((c) => {
            const active = activeCatalog === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCatalog(c.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer border ${
                  active ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100'
                }`}
              >
                {c.name_uz}
              </button>
            );
          })}
        </div>

        <div className="px-3 py-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={nodeSearch} onChange={(e) => setNodeSearch(e.target.value)}
              placeholder="Kategoriya qidirish…"
              className="w-full pl-8 pr-2.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-hidden focus:border-blue-600"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
          {loadingTree ? (
            <div className="flex items-center justify-center py-10 text-gray-400 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda…
            </div>
          ) : catalogNodes.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">Kategoriya topilmadi.</p>
          ) : (
            catalogNodes.map((n) => {
              const active = selected?.id === n.id;
              return (
                <button
                  key={n.id}
                  onClick={() => setSelected(n)}
                  className={`w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl transition-colors cursor-pointer ${
                    active ? 'bg-blue-50 text-blue-800 font-bold' : 'hover:bg-gray-50 text-gray-700'
                  } ${n.isSub ? 'ml-4' : ''}`}
                >
                  <CategoryChip name={n.icon || 'Layers'} size="sm" tone={CAT_TONE[n.catalog_id]} className="w-6 h-6 shrink-0" />
                  <span className="text-xs truncate">
                    {n.isSub ? <span className="text-gray-400">↳ </span> : null}
                    {n.name_uz}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* RIGHT: attribute editor list */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-xs flex flex-col overflow-hidden lg:h-[calc(100vh-190px)]">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="min-w-0">
            {selected ? (
              <>
                <h3 className="font-extrabold text-sm text-gray-950 truncate">{selected.name_uz}</h3>
                <p className="text-[11px] text-gray-500 truncate">
                  {selected.isSub && selected.parentName ? `${selected.parentName} › ` : ''}
                  {attrs.length} ta filtr · {selected.id}
                </p>
              </>
            ) : (
              <h3 className="font-extrabold text-sm text-gray-400">Chapdan kategoriya tanlang</h3>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => selected && loadAttrs(selected)}
              disabled={!selected}
              title="Qayta yuklash"
              className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={openAdd}
              disabled={!selected || saving}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-40 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Yangi filtr
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!selected ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 gap-2 py-16">
              <ArrowLeftRight className="w-8 h-8" />
              <p className="text-xs max-w-xs">Filtrlarni tahrirlash uchun chapdagi ro‘yxatdan katalog va kategoriya tanlang.</p>
            </div>
          ) : loadingAttrs ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Filtrlar yuklanmoqda…
            </div>
          ) : attrs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 gap-2 py-16">
              <Filter className="w-8 h-8" />
              <p className="text-xs">Bu kategoriyada hozircha filtr yo‘q. “Yangi filtr” tugmasi bilan qo‘shing.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {grouped.map(([section, list]) => (
                <div key={section}>
                  <h4 className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wide mb-2 px-1">{section}</h4>
                  <div className="space-y-2">
                    {list.map((a) => {
                      const gi = attrs.findIndex((x) => x.id === a.id);
                      return (
                        <div key={a.id} className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 hover:border-gray-200 bg-gray-50/40 group">
                          <div className="flex flex-col gap-0.5 shrink-0">
                            <button onClick={() => move(a.id, -1)} disabled={gi <= 0 || saving} className="p-0.5 rounded text-gray-400 hover:text-blue-600 disabled:opacity-30 cursor-pointer">
                              <ChevronUp className="w-4 h-4" />
                            </button>
                            <button onClick={() => move(a.id, 1)} disabled={gi >= attrs.length - 1 || saving} className="p-0.5 rounded text-gray-400 hover:text-blue-600 disabled:opacity-30 cursor-pointer">
                              <ChevronDown className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-gray-900 truncate">{a.label}</span>
                              <span className="text-[10px] font-mono text-gray-400 bg-white border border-gray-100 rounded px-1.5 py-0.5">{a.key}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">{TYPE_BADGE[a.type] || a.type}</span>
                              {a.required && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-600">Majburiy</span>}
                              {a.is_popular && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 inline-flex items-center gap-0.5"><Star className="w-2.5 h-2.5" />Mashxur</span>}
                              {!a.filterable && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Filtrda yashirin</span>}
                            </div>
                            {(a.options?.length || a.unit) && (
                              <p className="text-[11px] text-gray-500 mt-1 truncate">
                                {a.unit ? <span className="mr-2">Birligi: <b>{a.unit}</b></span> : null}
                                {a.options?.length ? <>Variantlar ({a.options.length}): {a.options.slice(0, 8).join(', ')}{a.options.length > 8 ? '…' : ''}</> : null}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => openEdit(a)} className="p-2 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-white cursor-pointer" title="Tahrirlash">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(a)} disabled={saving} className="p-2 rounded-xl text-gray-500 hover:text-rose-600 hover:bg-white cursor-pointer disabled:opacity-40" title="O‘chirish">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AttributeEditModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        categoryLabel={selected ? `${selected.isSub && selected.parentName ? selected.parentName + ' › ' : ''}${selected.name_uz}` : ''}
        attribute={editing}
        onSave={handleSave}
      />
    </div>
  );
};

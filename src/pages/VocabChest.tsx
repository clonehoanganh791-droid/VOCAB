import { useState, useMemo } from 'react';
import { Search, Trash2, Pencil, FolderOpen, X, Check, ArrowRight, Folder } from 'lucide-react';
import { useVocab } from '@/context/VocabContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AudioControl } from '@/components/AudioControl';
import { DEFAULT_CHESTS, FALLBACK_CHEST_KEY } from '@/lib/categorizer';
import type { Vocabulary } from '@/lib/types';

export function VocabChest() {
  const { vocabs, deleteVocabs, updateVocab } = useVocab();
  const { t, tFn, lang } = useLanguage();
  const { show } = useToast();

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<Vocabulary | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveCategory, setMoveCategory] = useState('');
  const [expandedChests, setExpandedChests] = useState<Set<string>>(new Set());

  // Build chest groups with counts
  const chestGroups = useMemo(() => {
    const map = new Map<string, Vocabulary[]>();
    vocabs.forEach((v) => {
      const cat = v.category || 'General';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(v);
    });
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [vocabs]);

  const categories = useMemo(() => chestGroups.map(([cat]) => cat), [chestGroups]);

  const filtered = useMemo(() => {
    return vocabs.filter((v) => {
      if (filterCategory !== 'all' && v.category !== filterCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return v.word.toLowerCase().includes(q) || v.meaning.toLowerCase().includes(q);
      }
      return true;
    });
  }, [vocabs, search, filterCategory]);

  const allSelected = filtered.length > 0 && filtered.every((v) => selected.has(v.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((v) => v.id)));
    }
  };

  const handleDeleteSelected = async () => {
    setConfirmOpen(false);
    const ids = Array.from(selected);
    const { error } = await deleteVocabs(ids);
    if (error) {
      show(t('toastError'), 'error');
    } else {
      show(t('toastDeleted'), 'success');
      setSelected(new Set());
    }
  };

  const handleMoveSelected = async () => {
    if (!moveCategory.trim()) return;
    const ids = Array.from(selected);
    for (const id of ids) {
      await updateVocab(id, { category: moveCategory.trim() });
    }
    show(t('reclassified'), 'success');
    setSelected(new Set());
    setMoveOpen(false);
    setMoveCategory('');
  };

  const handleSaveEdit = async (updates: Partial<Vocabulary>) => {
    if (!editTarget) return;
    const { error } = await updateVocab(editTarget.id, updates);
    if (error) {
      show(t('toastError'), 'error');
    } else {
      show(t('toastUpdated'), 'success');
      setEditTarget(null);
    }
  };

  const toggleChest = (cat: string) => {
    setExpandedChests((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Chest display name
  const chestDisplayName = (cat: string): string => {
    // Check if it's a default chest key
    const defaultChest = DEFAULT_CHESTS.find((c) => c.key === cat);
    if (defaultChest) return lang === 'vi' ? defaultChest.nameVi : defaultChest.nameEn;
    // Check if it matches a default chest name
    for (const c of DEFAULT_CHESTS) {
      if (cat === c.nameEn || cat === c.nameVi) return lang === 'vi' ? c.nameVi : c.nameEn;
    }
    if (cat === FALLBACK_CHEST_KEY || cat === 'General' || cat === 'Chung') {
      return lang === 'vi' ? 'Chung' : 'General';
    }
    return cat;
  };

  // Chest icon color
  const chestColor = (cat: string): string => {
    const key = DEFAULT_CHESTS.find((c) => c.key === cat || c.nameEn === cat || c.nameVi === cat)?.key;
    switch (key) {
      case 'technology': return 'from-sky-400 to-blue-500';
      case 'business': return 'from-emerald-400 to-teal-500';
      case 'dailyLife': return 'from-amber-400 to-orange-500';
      case 'academic': return 'from-violet-400 to-purple-500';
      case 'communication': return 'from-rose-400 to-pink-500';
      default: return 'from-slate-400 to-slate-500';
    }
  };

  if (vocabs.length === 0) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <div className="w-20 h-20 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <FolderOpen className="w-10 h-10 text-slate-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-700">{t('noWords')}</h3>
        <p className="text-sm text-slate-500 mt-1">{t('noWordsDesc')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-sm font-semibold text-slate-500">{t('totalWords')}</span>
          <span className="text-lg font-bold text-sky-600">{vocabs.length}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-sm">
          <span className="text-sm font-semibold text-slate-500">{t('categories')}</span>
          <span className="text-lg font-bold text-teal-600">{chestGroups.length}</span>
        </div>
      </div>

      {/* Chest folder cards */}
      {filterCategory === 'all' && !search.trim() && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">{t('categories')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {chestGroups.map(([cat, words]) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className="group bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md hover:border-sky-300 transition-all text-left"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${chestColor(cat)} flex items-center justify-center mb-3 shadow-sm`}>
                  <Folder className="w-5 h-5 text-white" />
                </div>
                <p className="font-bold text-slate-800 text-sm truncate">{chestDisplayName(cat)}</p>
                <p className="text-xs text-slate-400 mt-0.5">{tFn('wordsCount', words.length)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
            placeholder={t('searchWords')}
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer"
        >
          <option value="all">{t('allCategories')}</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{chestDisplayName(cat)}</option>
          ))}
        </select>
      </div>

      {/* Select all */}
      <div className="flex items-center justify-between mb-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
          />
          {t('selectAll')}
        </label>
        <span className="text-sm text-slate-400">{filtered.length} / {vocabs.length}</span>
      </div>

      {/* Word cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((vocab) => (
          <div
            key={vocab.id}
            className={`group bg-white rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md ${
              selected.has(vocab.id) ? 'border-sky-400 ring-2 ring-sky-100' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start gap-3 flex-1">
                <input
                  type="checkbox"
                  checked={selected.has(vocab.id)}
                  onChange={() => toggleSelect(vocab.id)}
                  className="w-4 h-4 mt-1 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-800 text-lg truncate">{vocab.word}</h3>
                    {vocab.type && (
                      <span className="text-xs font-semibold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">
                        {vocab.type}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-0.5">{vocab.meaning}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-xs font-medium text-white bg-gradient-to-r ${chestColor(vocab.category)} px-2 py-0.5 rounded-full`}>
                      {chestDisplayName(vocab.category)}
                    </span>
                    {vocab.error_count > 0 && (
                      <span className="text-xs font-medium text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                        {vocab.error_count} {t('errorCount').toLowerCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setEditTarget(vocab)}
                className="text-slate-300 hover:text-sky-500 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <AudioControl text={vocab.word} size="sm" showSpeed={false} />
              <button
                onClick={() => {
                  setSelected(new Set([vocab.id]));
                  setConfirmOpen(true);
                }}
                className="text-slate-300 hover:text-rose-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Floating action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-slate-800 text-white px-5 py-3 rounded-2xl shadow-2xl animate-slide-up">
          <span className="text-sm font-semibold">{selected.size} {t('deleteSelected').toLowerCase()}</span>
          <div className="w-px h-6 bg-slate-600" />
          <button
            onClick={() => setMoveOpen(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-sky-300 hover:text-sky-200 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            {t('moveSelected')}
          </button>
          <button
            onClick={() => setConfirmOpen(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-rose-300 hover:text-rose-200 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {t('deleteSelected')}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Move dialog */}
      {moveOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{t('moveSelected')}</h3>
            <select
              value={moveCategory}
              onChange={(e) => setMoveCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all mb-3 cursor-pointer"
            >
              <option value="">{t('selectChest')}</option>
              {DEFAULT_CHESTS.map((c) => (
                <option key={c.key} value={lang === 'vi' ? c.nameVi : c.nameEn}>
                  {lang === 'vi' ? c.nameVi : c.nameEn}
                </option>
              ))}
              <option value={lang === 'vi' ? 'Chung' : 'General'}>
                {lang === 'vi' ? 'Chung' : 'General'}
              </option>
              {categories.map((cat) => {
                const isDefault = DEFAULT_CHESTS.some((c) => c.key === cat || c.nameEn === cat || c.nameVi === cat);
                if (isDefault) return null;
                return <option key={cat} value={cat}>{cat}</option>;
              })}
            </select>
            <input
              value={moveCategory}
              onChange={(e) => setMoveCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all mb-4"
              placeholder={t('orCreateNew')}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setMoveOpen(false)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleMoveSelected}
                disabled={!moveCategory.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-sky-500 hover:bg-sky-600 transition-colors disabled:opacity-50"
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <EditModal
          vocab={editTarget}
          categories={categories}
          chestDisplayName={chestDisplayName}
          chestColor={chestColor}
          onSave={handleSaveEdit}
          onClose={() => setEditTarget(null)}
        />
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={t('confirmDeleteTitle')}
        message={selected.size > 1 ? t('confirmDeleteMsg') : t('confirmDeleteOne')}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onConfirm={handleDeleteSelected}
        onCancel={() => {
          setConfirmOpen(false);
          if (selected.size === 1) setSelected(new Set());
        }}
      />
    </div>
  );
}

function EditModal({
  vocab,
  categories,
  chestDisplayName,
  chestColor,
  onSave,
  onClose,
}: {
  vocab: Vocabulary;
  categories: string[];
  chestDisplayName: (cat: string) => string;
  chestColor: (cat: string) => string;
  onSave: (updates: Partial<Vocabulary>) => void;
  onClose: () => void;
}) {
  const { t, lang } = useLanguage();
  const [word, setWord] = useState(vocab.word);
  const [type, setType] = useState(vocab.type);
  const [meaning, setMeaning] = useState(vocab.meaning);
  const [category, setCategory] = useState(vocab.category);

  // Build chest options for edit modal
  const chestOptions = useMemo(() => {
    const defaults = DEFAULT_CHESTS.map((c) => ({
      key: c.key,
      name: lang === 'vi' ? c.nameVi : c.nameEn,
    }));
    defaults.push({ key: FALLBACK_CHEST_KEY, name: lang === 'vi' ? 'Chung' : 'General' });
    for (const cat of categories) {
      const isDefault = defaults.some((d) => d.key === cat || d.name === cat || cat === d.name);
      if (!isDefault) {
        defaults.push({ key: cat, name: cat });
      }
    }
    return defaults;
  }, [categories, lang]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800">{t('editWord')}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{t('word')}</label>
            <input value={word} onChange={(e) => setWord(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{t('type')}</label>
            <input value={type} onChange={(e) => setType(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{t('meaning')}</label>
            <input value={meaning} onChange={(e) => setMeaning(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-400 transition-all" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">{t('chest')}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 transition-all cursor-pointer"
            >
              {chestOptions.map((opt) => (
                <option key={opt.key} value={opt.name}>{opt.name}</option>
              ))}
              {category && !chestOptions.some((o) => o.name === category) && (
                <option value={category}>{category}</option>
              )}
            </select>
          </div>
        </div>
        <div className="mt-5 flex gap-3 justify-end">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
            {t('cancel')}
          </button>
          <button
            onClick={() => onSave({ word: word.trim(), type: type.trim(), meaning: meaning.trim(), category: category.trim() || 'General' })}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-sky-500 hover:bg-sky-600 transition-colors"
          >
            <Check className="w-4 h-4" />
            {t('saveChanges')}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useMemo } from 'react';
import { Plus, Upload, FileText, Trash2, Check, FileUp, Loader2, Sparkles, Volume2, AlertTriangle, X, ArrowRight } from 'lucide-react';
import { useVocab } from '@/context/VocabContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/components/Toast';
import { parseFile, parseVocabText } from '@/lib/fileParser';
import { autoCategorize, getChestName, DEFAULT_CHESTS, FALLBACK_CHEST_KEY } from '@/lib/categorizer';
import { speak } from '@/lib/speech';
import { validateVocabWithGemini, type VocabValidationResult } from '@/lib/gemini';
import type { ParsedVocab } from '@/lib/types';

const AUTO_KEY = '__auto__';

export function AddVocabulary() {
  const { addVocab, addManyVocabs, existingWords, vocabs } = useVocab();
  const { t, tFn, lang } = useLanguage();
  const { show } = useToast();

  const [mode, setMode] = useState<'quick' | 'bulk'>('quick');

  // Quick add
  const [word, setWord] = useState('');
  const [type, setType] = useState('');
  const [meaning, setMeaning] = useState('');
  const [chestChoice, setChestChoice] = useState<string>(AUTO_KEY);
  const [customChest, setCustomChest] = useState('');

  // Bulk import
  const [bulkText, setBulkText] = useState('');
  const [bulkChestChoice, setBulkChestChoice] = useState<string>(AUTO_KEY);
  const [bulkCustomChest, setBulkCustomChest] = useState('');
  const [parsed, setParsed] = useState<ParsedVocab[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [parsing, setParsing] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // AI validation state
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<VocabValidationResult | null>(null);

  // Existing custom categories from user's vocabs
  const existingCategories = useMemo(() => {
    const set = new Set<string>();
    vocabs.forEach((v) => set.add(v.category || 'General'));
    return Array.from(set).sort();
  }, [vocabs]);

  // Build chest options list
  const chestOptions = useMemo(() => {
    const defaults = DEFAULT_CHESTS.map((c) => ({
      key: c.key,
      name: lang === 'vi' ? c.nameVi : c.nameEn,
    }));
    defaults.push({ key: FALLBACK_CHEST_KEY, name: lang === 'vi' ? 'Chung' : 'General' });
    // Add existing custom categories not in defaults
    for (const cat of existingCategories) {
      const isDefault = defaults.some((d) => d.key === cat || d.name === cat);
      if (!isDefault) {
        defaults.push({ key: cat, name: cat });
      }
    }
    return defaults;
  }, [existingCategories, lang]);

  const resolveChest = (choice: string, custom: string, w: string, m: string): string => {
    if (custom.trim()) return custom.trim();
    if (choice === AUTO_KEY) return autoCategorize(w, m);
    return choice;
  };

  const saveWord = async (wordToSave: string, typeToSave: string, meaningToSave: string) => {
    const finalCategory = resolveChest(chestChoice, customChest, wordToSave, meaningToSave);
    const { error } = await addVocab({
      word: wordToSave,
      type: typeToSave,
      meaning: meaningToSave,
      category: finalCategory,
    });
    if (error) {
      show(t('toastError'), 'error');
    } else {
      const chestName = getChestName(finalCategory, lang);
      show(`${t('addSuccess')} — ${t('autoCategorized')} ${chestName}`, 'success');
      setWord('');
      setType('');
      setMeaning('');
      setChestChoice(AUTO_KEY);
      setCustomChest('');
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!word.trim() || !meaning.trim()) {
      show(t('fillAllFields'), 'error');
      return;
    }
    if (existingWords.has(word.trim().toLowerCase())) {
      show(t('wordExists'), 'error');
      return;
    }

    setValidating(true);
    try {
      const result = await validateVocabWithGemini({
        word: word.trim(),
        meaning: meaning.trim(),
        type: type.trim(),
      });
      if (!result.hasErrors) {
        // Word is accurate — save immediately
        await saveWord(word.trim(), type.trim(), meaning.trim());
        show(t('aiValidationPerfect'), 'success');
      } else {
        // Has errors — show correction modal
        setValidationResult(result);
      }
    } catch {
      // Fallback: save original input on API failure
      await saveWord(word.trim(), type.trim(), meaning.trim());
    }
    setValidating(false);
  };

  const handleApplyCorrections = async () => {
    if (!validationResult) return;
    const { corrected } = validationResult;
    setValidating(false);
    setValidationResult(null);
    await saveWord(corrected.word, corrected.partOfSpeech, corrected.meaning);
  };

  const handleKeepOriginal = async () => {
    setValidationResult(null);
    await saveWord(word.trim(), type.trim(), meaning.trim());
  };

  const handleCancelValidation = () => {
    setValidationResult(null);
    setValidating(false);
  };

  const handleParseText = () => {
    if (!bulkText.trim()) return;
    setParsing(true);
    const baseCat = bulkCustomChest.trim() || (bulkChestChoice === AUTO_KEY ? '' : bulkChestChoice);
    const result = parseVocabText(bulkText, baseCat || 'General');
    // Auto-categorize each parsed word if in auto mode
    if (bulkChestChoice === AUTO_KEY && !bulkCustomChest.trim()) {
      const autoResult = result.map((v) => ({
        ...v,
        category: autoCategorize(v.word, v.meaning),
      }));
      setParsed(autoResult);
    } else {
      const finalCat = bulkCustomChest.trim() || getChestName(bulkChestChoice, lang);
      setParsed(result.map((v) => ({ ...v, category: finalCat })));
    }
    setSelectedIndices(new Set(result.map((_, i) => i)));
    setParsing(false);
    if (result.length === 0) {
      show(t('noWordsParsed'), 'error');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    try {
      const baseCat = bulkCustomChest.trim() || (bulkChestChoice === AUTO_KEY ? '' : bulkChestChoice);
      const result = await parseFile(file, baseCat || 'General');
      if (bulkChestChoice === AUTO_KEY && !bulkCustomChest.trim()) {
        const autoResult = result.map((v) => ({
          ...v,
          category: autoCategorize(v.word, v.meaning),
        }));
        setParsed(autoResult);
      } else {
        const finalCat = bulkCustomChest.trim() || getChestName(bulkChestChoice, lang);
        setParsed(result.map((v) => ({ ...v, category: finalCat })));
      }
      setSelectedIndices(new Set(result.map((_, i) => i)));
      if (result.length === 0) {
        show(t('noWordsParsed'), 'error');
      }
    } catch {
      show(t('toastError'), 'error');
    }
    setParsing(false);
  };

  const handleSaveSelected = async () => {
    const selected = parsed.filter((_, i) => selectedIndices.has(i));
    if (selected.length === 0) return;
    const { error, count } = await addManyVocabs(selected);
    if (error) {
      show(t('toastError'), 'error');
    } else {
      show(tFn('toastImported', count), 'success');
      setParsed([]);
      setSelectedIndices(new Set());
      setBulkText('');
      setFileName('');
    }
  };

  const toggleSelect = (i: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === parsed.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(parsed.map((_, i) => i)));
    }
  };

  const removeFromParsed = (i: number) => {
    setParsed((prev) => prev.filter((_, idx) => idx !== i));
    setSelectedIndices((prev) => {
      const next = new Set<number>();
      for (const idx of prev) {
        if (idx < i) next.add(idx);
        else if (idx > i) next.add(idx - 1);
      }
      return next;
    });
  };

  // Update a single parsed item's category
  const updateParsedCategory = (i: number, newCat: string) => {
    setParsed((prev) => prev.map((v, idx) => idx === i ? { ...v, category: newCat } : v));
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Mode toggle */}
      <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setMode('quick')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === 'quick' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'
          }`}
        >
          <Plus className="w-4 h-4" />
          {t('quickAdd')}
        </button>
        <button
          onClick={() => setMode('bulk')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === 'bulk' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500'
          }`}
        >
          <Upload className="w-4 h-4" />
          {t('bulkImport')}
        </button>
      </div>

      {/* Quick Add */}
      {mode === 'quick' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <form onSubmit={handleQuickAdd} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('word')}</label>
                <input
                  value={word}
                  onChange={(e) => setWord(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
                  placeholder={t('wordPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('type')}</label>
                <input
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
                  placeholder={t('typePlaceholder')}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('meaning')}</label>
                <input
                  value={meaning}
                  onChange={(e) => setMeaning(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
                  placeholder={t('meaningPlaceholder')}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                    {t('chest')}
                  </span>
                </label>
                <select
                  value={chestChoice}
                  onChange={(e) => { setChestChoice(e.target.value); setCustomChest(''); }}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all cursor-pointer"
                >
                  <option value={AUTO_KEY}>{t('autoDetect')}</option>
                  {chestOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.name}</option>
                  ))}
                </select>
              </div>
            </div>
            {chestChoice === AUTO_KEY && !customChest && (
              <div>
                <label className="block text-sm font-semibold text-slate-500 mb-1.5">{t('orCreateNew')}</label>
                <input
                  value={customChest}
                  onChange={(e) => setCustomChest(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
                  placeholder={t('newCategory')}
                />
              </div>
            )}
            <button
              type="submit"
              disabled={validating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 text-white font-semibold hover:from-sky-600 hover:to-teal-600 transition-all shadow-sm disabled:opacity-70"
            >
              {validating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('aiValidating')}
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  {t('addWord')}
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* AI Validation Modal */}
      {validationResult && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-800">{t('aiValidationTitle')}</h3>
              </div>
              <button
                onClick={handleCancelValidation}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Side-by-side diff */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {/* Original input */}
              <div className="rounded-xl border-2 border-rose-200 bg-rose-50 p-4">
                <p className="text-xs font-bold text-rose-600 uppercase tracking-wide mb-3">{t('aiValidationYourInput')}</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-rose-400">{t('word')}</p>
                    <p className="text-sm font-semibold text-rose-700 line-through">{validationResult.original.word}</p>
                  </div>
                  <div>
                    <p className="text-xs text-rose-400">{t('meaning')}</p>
                    <p className="text-sm font-semibold text-rose-700 line-through">{validationResult.original.meaning}</p>
                  </div>
                </div>
              </div>

              {/* AI suggestion */}
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide mb-3">{t('aiValidationSuggestion')}</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-emerald-400">{t('word')}</p>
                    <p className="text-sm font-semibold text-emerald-700">{validationResult.corrected.word}</p>
                  </div>
                  {validationResult.corrected.ipa && (
                    <div>
                      <p className="text-xs text-emerald-400">{t('aiValidationIPA')}</p>
                      <p className="text-sm font-mono text-emerald-700">{validationResult.corrected.ipa}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-emerald-400">{t('aiValidationPartOfSpeech')}</p>
                    <p className="text-sm font-semibold text-emerald-700">{validationResult.corrected.partOfSpeech}</p>
                  </div>
                  <div>
                    <p className="text-xs text-emerald-400">{t('meaning')}</p>
                    <p className="text-sm font-semibold text-emerald-700">{validationResult.corrected.meaning}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {validationResult.notes.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-5">
                <div className="flex items-start gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-bold text-amber-700">{t('aiValidationNotes')}</p>
                </div>
                <ul className="space-y-1.5 ml-6">
                  {validationResult.notes.map((note, i) => (
                    <li key={i} className="text-sm text-amber-600 flex items-start gap-1.5">
                      <span className="text-amber-400 mt-0.5">•</span>
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleApplyCorrections}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transition-all shadow-sm"
              >
                <Check className="w-4 h-4" />
                {t('aiValidationApply')}
              </button>
              <button
                onClick={handleKeepOriginal}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                {t('aiValidationKeepOriginal')}
              </button>
              <button
                onClick={handleCancelValidation}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
              >
                {t('aiValidationCancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import */}
      {mode === 'bulk' && (
        <div className="space-y-6">
          {/* Chest selector for bulk */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                {t('chest')}
              </span>
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={bulkChestChoice}
                onChange={(e) => { setBulkChestChoice(e.target.value); setBulkCustomChest(''); }}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all cursor-pointer"
              >
                <option value={AUTO_KEY}>{t('autoDetect')}</option>
                {chestOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.name}</option>
                ))}
              </select>
              <input
                value={bulkCustomChest}
                onChange={(e) => setBulkCustomChest(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
                placeholder={t('orCreateNew')}
              />
            </div>
            {bulkChestChoice === AUTO_KEY && !bulkCustomChest.trim() && (
              <p className="mt-2 text-xs text-sky-600 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {t('autoDetected')} — {t('autoCategorized')} {lang === 'vi' ? 'từng từ' : 'each word individually'}
              </p>
            )}
          </div>

          {/* File upload */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <FileUp className="w-5 h-5 text-sky-500" />
              <h3 className="font-bold text-slate-800">{t('importFromFile')}</h3>
            </div>
            <p className="text-sm text-slate-500 mb-3">{t('supportedFormats')}</p>
            <p className="text-sm text-slate-500 mb-4 font-mono bg-slate-50 rounded-lg px-3 py-2">{t('parseFormat')}</p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 font-semibold hover:border-sky-400 hover:text-sky-600 transition-colors"
              >
                <Upload className="w-5 h-5" />
                {t('selectFile')}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.docx,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              {fileName && (
                <span className="text-sm text-slate-500 flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  {fileName}
                </span>
              )}
            </div>
          </div>

          {/* Text paste */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-sky-500" />
              <h3 className="font-bold text-slate-800">{t('importFromText')}</h3>
            </div>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all resize-y"
              placeholder={t('pasteHere')}
            />
            <button
              onClick={handleParseText}
              disabled={parsing || !bulkText.trim()}
              className="mt-3 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700 text-white font-semibold hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {parsing ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
              {parsing ? t('parsing') : t('parseText')}
            </button>
          </div>

          {/* Preview */}
          {parsed.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-slate-800">{t('preview')}</h3>
                  <span className="text-sm font-semibold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full">
                    {parsed.length} {t('parsedWords')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIndices.size === parsed.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                    />
                    {t('selectAll')}
                  </label>
                  <button
                    onClick={handleSaveSelected}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 text-white font-semibold hover:from-sky-600 hover:to-teal-600 transition-all shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    {t('saveSelected')} ({selectedIndices.size})
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('word')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('type')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('meaning')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('chest')}</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsed.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIndices.has(i)}
                            onChange={() => toggleSelect(i)}
                            className="w-4 h-4 rounded border-slate-300 text-sky-500 focus:ring-sky-400"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-slate-800">{item.word}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => speak(item.word)}
                            className="w-7 h-7 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-500 flex items-center justify-center transition-colors"
                            title={t('playAudio')}
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{item.type || '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{item.meaning}</td>
                        <td className="px-4 py-3">
                          <select
                            value={item.category}
                            onChange={(e) => updateParsedCategory(i, e.target.value)}
                            className="text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer"
                          >
                            {chestOptions.map((opt) => (
                              <option key={opt.key} value={opt.name}>{opt.name}</option>
                            ))}
                            {item.category && !chestOptions.some((o) => o.name === item.category) && (
                              <option value={item.category}>{item.category}</option>
                            )}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => removeFromParsed(i)}
                            className="text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

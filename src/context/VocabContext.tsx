import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { getLocalVocabs, saveLocalVocabs, localToVocab } from '@/lib/storage';
import { autoCategorize } from '@/lib/categorizer';
import type { Vocabulary, ParsedVocab } from '@/lib/types';

interface VocabContextValue {
  vocabs: Vocabulary[];
  loading: boolean;
  refresh: () => Promise<void>;
  addVocab: (vocab: Omit<ParsedVocab, 'category'> & { category?: string }) => Promise<{ error: string | null }>;
  addManyVocabs: (vocabs: ParsedVocab[]) => Promise<{ error: string | null; count: number }>;
  updateVocab: (id: string, updates: Partial<Pick<Vocabulary, 'word' | 'type' | 'meaning' | 'category'>>) => Promise<{ error: string | null }>;
  deleteVocabs: (ids: string[]) => Promise<{ error: string | null }>;
  incrementError: (word: string) => Promise<void>;
  resetError: (word: string) => Promise<void>;
  existingWords: Set<string>;
}

const VocabContext = createContext<VocabContextValue | null>(null);

export function VocabProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [vocabs, setVocabs] = useState<Vocabulary[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      // Load from localStorage
      const local = getLocalVocabs();
      setVocabs(local.map((v, i) => localToVocab(v, i)));
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('vocabularies')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setVocabs(data as Vocabulary[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const existingWords = new Set(vocabs.map((v) => v.word.toLowerCase()));

  const addVocab = useCallback(async (vocab: Omit<ParsedVocab, 'category'> & { category?: string }) => {
    const category = vocab.category && vocab.category.trim() ? vocab.category.trim() : autoCategorize(vocab.word, vocab.meaning);
    if (!user) {
      const local = getLocalVocabs();
      local.push({ word: vocab.word, type: vocab.type, meaning: vocab.meaning, category });
      saveLocalVocabs(local);
      await refresh();
      return { error: null };
    }

    const { error } = await supabase.from('vocabularies').insert({
      word: vocab.word,
      type: vocab.type,
      meaning: vocab.meaning,
      category,
    });
    if (!error) await refresh();
    return { error: error?.message ?? null };
  }, [user, refresh]);

  const addManyVocabs = useCallback(async (newVocabs: ParsedVocab[]) => {
    if (newVocabs.length === 0) return { error: null, count: 0 };

    if (!user) {
      const local = getLocalVocabs();
      for (const v of newVocabs) {
        const cat = v.category && v.category !== 'General' ? v.category : autoCategorize(v.word, v.meaning);
        local.push({ word: v.word, type: v.type, meaning: v.meaning, category: cat });
      }
      saveLocalVocabs(local);
      await refresh();
      return { error: null, count: newVocabs.length };
    }

    const rows = newVocabs.map((v) => ({
      word: v.word,
      type: v.type,
      meaning: v.meaning,
      category: v.category && v.category !== 'General' ? v.category : autoCategorize(v.word, v.meaning),
    }));

    const { error } = await supabase.from('vocabularies').insert(rows);
    if (!error) await refresh();
    return { error: error?.message ?? null, count: error ? 0 : newVocabs.length };
  }, [user, refresh]);

  const updateVocab = useCallback(async (id: string, updates: Partial<Pick<Vocabulary, 'word' | 'type' | 'meaning' | 'category'>>) => {
    if (!user) return { error: 'Not authenticated' };

    const { error } = await supabase.from('vocabularies').update(updates).eq('id', id);
    if (!error) await refresh();
    return { error: error?.message ?? null };
  }, [user, refresh]);

  const deleteVocabs = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return { error: null };

    if (!user) {
      const local = getLocalVocabs();
      const filtered = local.filter((_, i) => !ids.includes(`local-${i}`));
      saveLocalVocabs(filtered);
      await refresh();
      return { error: null };
    }

    const { error } = await supabase.from('vocabularies').delete().in('id', ids);
    if (!error) await refresh();
    return { error: error?.message ?? null };
  }, [user, refresh]);

  const incrementError = useCallback(async (word: string) => {
    if (!user) return;
    const vocab = vocabs.find((v) => v.word.toLowerCase() === word.toLowerCase());
    if (!vocab) return;
    await supabase
      .from('vocabularies')
      .update({ error_count: (vocab.error_count || 0) + 1 })
      .eq('id', vocab.id);
    await refresh();
  }, [user, vocabs, refresh]);

  const resetError = useCallback(async (word: string) => {
    if (!user) return;
    const vocab = vocabs.find((v) => v.word.toLowerCase() === word.toLowerCase());
    if (!vocab) return;
    await supabase
      .from('vocabularies')
      .update({ error_count: 0 })
      .eq('id', vocab.id);
    await refresh();
  }, [user, vocabs, refresh]);

  return (
    <VocabContext.Provider value={{ vocabs, loading, refresh, addVocab, addManyVocabs, updateVocab, deleteVocabs, incrementError, resetError, existingWords }}>
      {children}
    </VocabContext.Provider>
  );
}

export function useVocab() {
  const ctx = useContext(VocabContext);
  if (!ctx) throw new Error('useVocab must be used within VocabProvider');
  return ctx;
}

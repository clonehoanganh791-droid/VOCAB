import type { Vocabulary, ParsedVocab } from './types';

const LOCAL_KEY = 'vocabmaster_local_vocabs';
const LANG_KEY = 'vocabmaster_lang';

export function getLocalVocabs(): ParsedVocab[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveLocalVocabs(vocabs: ParsedVocab[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(vocabs));
  } catch {
    // storage full or unavailable
  }
}

export function clearLocalVocabs() {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    // noop
  }
}

export function hasLocalVocabs(): boolean {
  return getLocalVocabs().length > 0;
}

export function getStoredLang(): 'en' | 'vi' {
  try {
    const lang = localStorage.getItem(LANG_KEY);
    if (lang === 'en' || lang === 'vi') return lang;
  } catch {
    // noop
  }
  return 'vi';
}

export function setStoredLang(lang: 'en' | 'vi') {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // noop
  }
}

// Practice history in localStorage (for analytics before cloud sync)
const PRACTICE_KEY = 'vocabmaster_practice_history';

export interface PracticeRecord {
  type: 'quiz' | 'typing' | 'sentence';
  vocabId?: string;
  word?: string;
  correct: boolean;
  accuracy?: number;
  timestamp: number;
}

export function getPracticeHistory(): PracticeRecord[] {
  try {
    const raw = localStorage.getItem(PRACTICE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function addPracticeRecord(record: PracticeRecord) {
  const history = getPracticeHistory();
  history.push(record);
  // Keep last 500 records
  const trimmed = history.slice(-500);
  try {
    localStorage.setItem(PRACTICE_KEY, JSON.stringify(trimmed));
  } catch {
    // noop
  }
}

export function clearPracticeHistory() {
  try {
    localStorage.removeItem(PRACTICE_KEY);
  } catch {
    // noop
  }
}

// Convert local vocabs to Vocabulary shape for display
export function localToVocab(local: ParsedVocab, index: number): Vocabulary {
  return {
    id: `local-${index}`,
    user_id: 'local',
    word: local.word,
    type: local.type,
    meaning: local.meaning,
    category: local.category || 'General',
    error_count: 0,
    created_at: new Date().toISOString(),
  };
}

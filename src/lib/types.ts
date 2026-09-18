export interface Vocabulary {
  id: string;
  user_id: string;
  word: string;
  type: string;
  meaning: string;
  category: string;
  error_count: number;
  created_at: string;
}

export type Language = 'en' | 'vi';

export type TabKey =
  | 'add'
  | 'chest'
  | 'quiz'
  | 'typing'
  | 'sentence'
  | 'analytics';

export interface ParsedVocab {
  word: string;
  type: string;
  meaning: string;
  category: string;
}

export interface QuizQuestion {
  vocab: Vocabulary;
  options: string[];
  correctIndex: number;
}

export interface QuizResult {
  vocabId: string;
  correct: boolean;
}

export interface TypingResult {
  vocabId: string;
  correct: boolean;
}

export interface SentenceResult {
  vocabId: string;
  accuracy: number;
  feedback: string;
  improved: string;
}

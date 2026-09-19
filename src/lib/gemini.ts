import { GoogleGenAI, Type } from '@google/genai';
import type { Language } from './types';
import type { GrammarEvaluation } from './grammarCheck';

const FALLBACK_API_KEY = 'AQ.Ab8RN6KeCsGvlXT4rIJAWqHlAXLGLEGAaGUPZbMnr5oyNK7btw';
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || FALLBACK_API_KEY;

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

const ai = new GoogleGenAI({ apiKey: API_KEY });

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    accuracyScore: { type: Type.NUMBER },
    isGrammarCorrect: { type: Type.BOOLEAN },
    isNatural: { type: Type.BOOLEAN },
    isTargetWordUsed: { type: Type.BOOLEAN },
    errorsFound: { type: Type.ARRAY, items: { type: Type.STRING } },
    detailedFeedback: { type: Type.STRING },
    improvedSentences: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          en: { type: Type.STRING },
          vi: { type: Type.STRING },
        },
        required: ['en', 'vi'],
      },
    },
    grammarBreakdown: { type: Type.STRING },
  },
  required: [
    'accuracyScore',
    'isGrammarCorrect',
    'isNatural',
    'errorsFound',
    'detailedFeedback',
    'improvedSentences',
    'grammarBreakdown',
  ],
};

export function isGeminiConfigured(): boolean {
  return !!API_KEY;
}

export async function evaluateWithGemini(params: {
  sentence: string;
  targetWord: string;
  wordType: string;
  meaning: string;
  lang: Language;
}): Promise<GrammarEvaluation> {
  const { sentence, targetWord, wordType, meaning, lang } = params;
  const isVi = lang === 'vi';

  const prompt = `You are a senior English language expert and pedagogical evaluator for a vocabulary learning app. The user is practicing using the target word "${targetWord}" (part of speech: ${wordType}, meaning: ${meaning}) in a sentence.

Evaluate the sentence: "${sentence}"

You must analyze the sentence on TWO independent levels:

1. Grammar Accuracy (Đúng/Sai ngữ pháp):
   - Check basic grammar correctness: subject-verb agreement, articles, tense, word order, spelling, punctuation.
   - isGrammarCorrect = true only if there are zero grammar errors.

2. Naturalness / Collocation (Độ tự nhiên bản ngữ):
   - Evaluate whether a native English speaker would actually use this phrasing.
   - Flag awkward or unnatural collocations even if grammatically correct.
   - Example: "I have emotional growth" is grammatically correct but unnatural — a native speaker would say "I have experienced emotional growth" or "I have grown emotionally".
   - isNatural = true only if the sentence sounds natural and idiomatic to a native speaker.

Scoring:
- accuracyScore (0-100): Start at 100. Deduct for grammar errors AND for unnatural phrasing. A grammatically correct but unnatural sentence should score no higher than 75.

errorsFound: List each specific grammar, spelling, article, or unnaturalness error as a concise string. Include collocation issues (e.g., "Unnatural collocation: 'have emotional growth' — use 'experience emotional growth' or 'grow emotionally'").

detailedFeedback: Provide a thorough pedagogical breakdown in ${isVi ? 'Vietnamese' : 'English'}. Structure it with clear sections:
  - "Ngữ pháp" (Grammar): Explain what is correct or incorrect.
  - "Collocation & Tự nhiên" (Collocation & Naturalness): Explain natural word pairings, why the phrasing sounds awkward or natural, and suggest better collocations.
  - "Tone & Phong cách" (Tone & Style): Comment on register and tone if relevant.
  Use bullet points (•) for readability.

improvedSentences: Provide 2-3 natural, native-like alternative sentences using the target word. Each must include:
  - "en": the English sentence
  - "vi": the ${isVi ? 'Vietnamese translation' : 'Vietnamese translation'}
  Make these sentences varied in structure and tone to give the learner options.

grammarBreakdown: Detailed explanation of key grammar structures, advanced verbs, prepositions, and collocations used in the recommended sentences. Write in ${isVi ? 'Vietnamese' : 'English'}.

Rules:
- isTargetWordUsed: true if any form of "${targetWord}" appears (case-insensitive, including plurals, conjugations, slash-separated variants)
- If the target word contains slashes or parentheses, split into options and accept any match
- Be precise — do NOT report false positives for correctly capitalized "I" or correct article usage
- Keep responses concise but educational`;

  let lastError: Error | null = null;

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.4,
          responseMimeType: 'application/json',
          responseSchema,
        },
      });

      const text = response.text;
      if (!text) throw new Error('Empty Gemini response');

      const parsed = JSON.parse(text);

      const improvedSentences = (parsed.improvedSentences || []).map(
        (s: { en: string; vi: string }) => ({ en: s.en || '', vi: s.vi || '' })
      );

      // Use first improved sentence for backward-compat fields
      const firstImproved = improvedSentences[0];

      return {
        accuracy: Math.max(0, Math.min(100, parsed.accuracyScore)),
        isGrammarCorrect: parsed.isGrammarCorrect ?? (parsed.errorsFound || []).length === 0,
        isNatural: parsed.isNatural ?? false,
        errors: (parsed.errorsFound || []).map((msg: string) => ({
          message: msg,
          explanation: '',
        })),
        feedback: parsed.detailedFeedback || '',
        improved: firstImproved?.en || '',
        improvedTranslation: firstImproved?.vi || '',
        improvedSentences,
        grammarStructure: parsed.grammarBreakdown || '',
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message.toLowerCase();
      if (msg.includes('not found') || msg.includes('404') || msg.includes('400') || msg.includes('not supported')) {
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

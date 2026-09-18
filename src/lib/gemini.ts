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
    isTargetWordUsed: { type: Type.BOOLEAN },
    errorsFound: { type: Type.ARRAY, items: { type: Type.STRING } },
    detailedFeedback: { type: Type.STRING },
    modelSentence: { type: Type.STRING },
    modelSentenceTranslation: { type: Type.STRING },
    grammarBreakdown: { type: Type.STRING },
  },
  required: [
    'accuracyScore',
    'isTargetWordUsed',
    'errorsFound',
    'detailedFeedback',
    'modelSentence',
    'modelSentenceTranslation',
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

  const prompt = `You are an expert English grammar evaluator for a vocabulary learning app. The user is practicing using the target word "${targetWord}" (part of speech: ${wordType}, meaning: ${meaning}) in a sentence.

Evaluate the sentence: "${sentence}"

Rules:
- isTargetWordUsed: true if any form of "${targetWord}" appears in the sentence (case-insensitive, including plurals, conjugations, and slash-separated variants)
- accuracyScore: 100 = perfect, deduct for each real grammar error
- If the target word contains slashes or parentheses, split into options and accept any match
- Be precise — do NOT report false positives for correctly capitalized "I" or correct article usage
- errorsFound: list each error briefly
- detailedFeedback: explain grammar rules clearly in ${isVi ? 'Vietnamese' : 'English'}
- modelSentence: a natural, correct English sentence using the target word
- modelSentenceTranslation: ${isVi ? 'Vietnamese translation of the model sentence' : 'English explanation of the model sentence'}
- grammarBreakdown: identify the grammar structure (Subject + Verb + Object/Complement) in ${isVi ? 'Vietnamese' : 'English'}
- Keep responses concise and educational`;

  let lastError: Error | null = null;

  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.3,
          responseMimeType: 'application/json',
          responseSchema,
        },
      });

      const text = response.text;
      if (!text) throw new Error('Empty Gemini response');

      const parsed = JSON.parse(text);

      return {
        accuracy: Math.max(0, Math.min(100, parsed.accuracyScore)),
        errors: (parsed.errorsFound || []).map((msg: string) => ({
          message: msg,
          explanation: '',
        })),
        feedback: parsed.detailedFeedback || '',
        improved: parsed.modelSentence || '',
        improvedTranslation: parsed.modelSentenceTranslation || '',
        grammarStructure: parsed.grammarBreakdown || '',
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Try next model on not-found / unavailable errors
      const msg = lastError.message.toLowerCase();
      if (msg.includes('not found') || msg.includes('404') || msg.includes('400') || msg.includes('not supported')) {
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

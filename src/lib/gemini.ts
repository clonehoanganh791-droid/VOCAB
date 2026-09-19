import { GoogleGenAI, Type } from '@google/genai';
import type { Language } from './types';
import type { GrammarEvaluation, DetectedError, NativeAlternative, ErrorType } from './grammarCheck';

const FALLBACK_API_KEY = 'AQ.Ab8RN6KeCsGvlXT4rIJAWqHlAXLGLEGAaGUPZbMnr5oyNK7btw';
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || FALLBACK_API_KEY;

const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

const ai = new GoogleGenAI({ apiKey: API_KEY });

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    accuracyScore: { type: Type.NUMBER },
    isSpellingCorrect: { type: Type.BOOLEAN },
    isGrammarCorrect: { type: Type.BOOLEAN },
    isNatural: { type: Type.BOOLEAN },
    isTargetWordUsed: { type: Type.BOOLEAN },
    detectedErrors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          incorrectPart: { type: Type.STRING },
          correction: { type: Type.STRING },
          explanationVi: { type: Type.STRING },
        },
        required: ['type', 'incorrectPart', 'correction', 'explanationVi'],
      },
    },
    detailedAnalysisVi: { type: Type.STRING },
    nativeAlternatives: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sentence: { type: Type.STRING },
          translation: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: ['sentence', 'translation', 'explanation'],
      },
    },
    grammarRulesBreakdown: { type: Type.STRING },
  },
  required: [
    'accuracyScore',
    'isSpellingCorrect',
    'isGrammarCorrect',
    'isNatural',
    'detectedErrors',
    'detailedAnalysisVi',
    'nativeAlternatives',
    'grammarRulesBreakdown',
  ],
};

export function isGeminiConfigured(): boolean {
  return !!API_KEY;
}

function safeParseJSON(text: string): Record<string, unknown> {
  let cleaned = text.trim();
  // Strip ```json ... ``` or ``` ... ``` fences
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  // Sometimes the fences are inline or multiple — extract the first { ... } block
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }
  return JSON.parse(cleaned);
}

function buildFallbackAlternatives(targetWord: string, wordType: string, meaning: string): NativeAlternative[] {
  const word = targetWord.replace(/\s*\([^)]*\)\s*/g, '').split(/\s*\/\s*/)[0].trim();
  const lower = word.toLowerCase();

  const alternatives: NativeAlternative[] = [];

  if (wordType.toLowerCase().includes('verb')) {
    alternatives.push({
      sentence: `I ${lower} every day to improve myself.`,
      translation: `Tôi ${meaning.toLowerCase()} mỗi ngày để phát triển bản thân.`,
      explanation: 'Cấu trúc S + V + O dùng thì hiện tại đơn diễn tả thói quen.',
    });
    alternatives.push({
      sentence: `She has ${lower}ed consistently to achieve her goals.`,
      translation: `Cô ấy đã ${meaning.toLowerCase()} nhất quán để đạt được mục tiêu.`,
      explanation: 'Dùng thì hiện tại hoàn thành (have + V-ed) để nhấn mạnh sự kiên trì.',
    });
  } else if (wordType.toLowerCase().includes('adj')) {
    alternatives.push({
      sentence: `The result was truly ${lower}, exceeding all expectations.`,
      translation: `Kết quả thực sự ${meaning.toLowerCase()}, vượt mọi kỳ vọng.`,
      explanation: 'Vị trí tính từ sau động từ "to be" làm bổ ngữ (complement).',
    });
    alternatives.push({
      sentence: `He found the situation ${lower} and decided to act.`,
      translation: `Anh ấy thấy tình huống ${meaning.toLowerCase()} và quyết định hành động.`,
      explanation: 'Tính từ đứng sau tân ngữ để bổ nghĩa (find + O + Adj).',
    });
  } else if (wordType.toLowerCase().includes('noun') || wordType.toLowerCase().includes('n')) {
    alternatives.push({
      sentence: `Developing ${lower} is essential for long-term success.`,
      translation: `Phát triển ${meaning.toLowerCase()} là điều kiện thiết yếu cho thành công dài hạn.`,
      explanation: 'Danh từ làm tân ngữ cho động từ "developing".',
    });
    alternatives.push({
      sentence: `Her ${lower} helped her overcome many challenges.`,
      translation: `${meaning.charAt(0).toUpperCase() + meaning.slice(1).toLowerCase()} của cô ấy đã giúp cô ấy vượt qua nhiều thử thách.`,
      explanation: 'Danh từ làm chủ ngữ cho câu, theo sau là động từ "helped".',
    });
  } else {
    alternatives.push({
      sentence: `Practicing ${lower} regularly will bring great results.`,
      translation: `Thực hành ${meaning.toLowerCase()} thường xuyên sẽ mang lại kết quả tốt.`,
      explanation: 'Cấu trúc V-ing làm chủ ngữ.',
    });
    alternatives.push({
      sentence: `You should focus on ${lower} to achieve your goals.`,
      translation: `Bạn nên tập trung vào ${meaning.toLowerCase()} để đạt được mục tiêu.`,
      explanation: 'Dùng "focus on + N/V-ing" để diễn tả sự tập trung.',
    });
  }

  return alternatives;
}

export async function evaluateWithGemini(params: {
  sentence: string;
  targetWord: string;
  wordType: string;
  meaning: string;
  lang: Language;
}): Promise<GrammarEvaluation> {
  const { sentence, targetWord, wordType, meaning } = params;

  const prompt = `You are a senior English language expert and strict pedagogical evaluator for a vocabulary learning app. The user is practicing using the target word "${targetWord}" (part of speech: ${wordType}, meaning: ${meaning}) in a sentence.

Evaluate the sentence: "${sentence}"

You MUST perform a 3-step verification pipeline before calculating scores:

STEP 1 — Spelling & Typo Scan:
- Scan character-by-character for any misspelled words or typos.
- If ANY typo exists (e.g., "verry" -> "very", "hav" -> "have"), set isSpellingCorrect = false and immediately cap accuracyScore below 50.
- List each spelling error in detectedErrors with type "Spelling".

STEP 2 — Structural & Grammar Check:
- Verify basic syntax integrity: the sentence must have at least Subject + Main Verb + Object/Complement.
- Check subject-verb agreement, articles, tense consistency, preposition usage, word order.
- If the sentence lacks a main verb, uses wrong tenses, or misuses prepositions, set isGrammarCorrect = false.
- List each grammar error in detectedErrors with type "Grammar" or "Structure".

STEP 3 — Target Word & Native Collocation:
- Verify the target word "${targetWord}" is used in its correct semantic context.
- Evaluate whether the phrasing is natural for native English speakers (isNatural).
- Flag awkward collocations even if grammatically correct (e.g., "I have emotional growth" is grammatically correct but unnatural — suggest "experience emotional growth" or "grow emotionally").
- List collocation issues in detectedErrors with type "Collocation".

SCORING:
- accuracyScore (0-100): Start at 100. Deduct for spelling errors (major), grammar errors (moderate), and unnatural phrasing (moderate).
- If any spelling error exists, cap accuracyScore below 50.
- A grammatically correct but unnatural sentence should score no higher than 75.

detectedErrors: Array of objects, each with:
  - type: "Spelling" | "Grammar" | "Structure" | "Collocation"
  - incorrectPart: the exact word/phrase from the user's input that is wrong
  - correction: the corrected word/phrase
  - explanationVi: detailed explanation in Vietnamese of why it is wrong and the grammar/spelling rule

detailedAnalysisVi: Comprehensive analysis in Vietnamese covering:
  - Điểm tốt (Strengths): what the user did well
  - Điểm cần cải thiện (Areas to improve): specific issues
  - Phối hợp từ (Collocation): natural word pairings
  - Sắc thái biểu đạt (Tone/Register): register and tone if relevant
  Use bullet points (•) and section headers for readability.

nativeAlternatives: 2-3 natural, native-like alternative sentences using the target word. Each with:
  - sentence: the English sentence
  - translation: Vietnamese translation
  - explanation: why this sentence is more natural/better in real communication, or what advanced grammar/vocabulary it uses
  Vary the structure and formality level across alternatives.

grammarRulesBreakdown: Summary of core grammar structures found in the example sentences, in Vietnamese.

Rules:
- isTargetWordUsed: true if any form of "${targetWord}" appears (case-insensitive, including plurals, conjugations, slash-separated variants)
- If the target word contains slashes or parentheses, split into options and accept any match
- Be precise — do NOT report false positives for correctly capitalized "I" or correct article usage
- Keep responses thorough but concise`;

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

      const parsed = safeParseJSON(text);

      const detectedErrorsRaw = (parsed.detectedErrors || []) as Array<{ type: string; incorrectPart: string; correction: string; explanationVi: string }>;
      const detectedErrors: DetectedError[] = detectedErrorsRaw.map(
        (e) => ({
          type: (e.type as ErrorType) || 'Grammar',
          incorrectPart: e.incorrectPart || '',
          correction: e.correction || '',
          explanationVi: e.explanationVi || '',
        })
      );

      const nativeAlternativesRaw = (parsed.nativeAlternatives || []) as Array<{ sentence: string; translation: string; explanation: string }>;
      const nativeAlternatives: NativeAlternative[] = nativeAlternativesRaw.map(
        (s) => ({
          sentence: s.sentence || '',
          translation: s.translation || '',
          explanation: s.explanation || '',
        })
      ).filter((s) => s.sentence.trim().length > 0);

      // If Gemini returned no alternatives, generate proper fallbacks for the target word
      const effectiveAlternatives = nativeAlternatives.length > 0
        ? nativeAlternatives
        : buildFallbackAlternatives(targetWord, wordType, meaning);

      // Legacy compat: map detectedErrors to flat errors array
      const errors = detectedErrors.map((e) => ({
        message: e.incorrectPart ? `"${e.incorrectPart}" → "${e.correction}"` : e.correction,
        explanation: e.explanationVi,
      }));

      const firstAlt = effectiveAlternatives[0];

      return {
        accuracy: Math.max(0, Math.min(100, parsed.accuracyScore as number)),
        isSpellingCorrect: (parsed.isSpellingCorrect as boolean) ?? true,
        isGrammarCorrect: (parsed.isGrammarCorrect as boolean) ?? detectedErrors.length === 0,
        isNatural: (parsed.isNatural as boolean) ?? false,
        detectedErrors,
        detailedAnalysisVi: (parsed.detailedAnalysisVi as string) || '',
        nativeAlternatives: effectiveAlternatives,
        grammarRulesBreakdown: (parsed.grammarRulesBreakdown as string) || '',
        errors,
        feedback: (parsed.detailedAnalysisVi as string) || '',
        improved: firstAlt?.sentence || '',
        improvedTranslation: firstAlt?.translation || '',
        improvedSentences: effectiveAlternatives.map((s) => ({ en: s.sentence, vi: s.translation })),
        grammarStructure: (parsed.grammarRulesBreakdown as string) || '',
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

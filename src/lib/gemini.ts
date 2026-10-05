import { Type } from '@google/genai';
import type { Language } from './types';
import type { GrammarEvaluation, DetectedError, NativeAlternative, ErrorType } from './grammarCheck';

// ===== Centralized API Key Resolution =====
// Priority: localStorage user key > env var > hardcoded fallback
const FALLBACK_API_KEY = 'AQ.Ab8RN6KeCsGvlXT4rIJAWqHlAXLGLEGAaGUPZbMnr5oyNK7btw';

function resolveApiKey(): string {
  if (typeof localStorage !== 'undefined') {
    const userKey = localStorage.getItem('user_gemini_api_key');
    if (userKey && userKey.trim()) return userKey.trim();
  }
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envKey && envKey.trim()) return envKey.trim();
  return FALLBACK_API_KEY;
}

// Models in priority order — gemini-2.0-flash is the proven working model
const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash'];

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// ===== Direct REST API call (bypasses SDK for reliability) =====
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string; code?: number };
}

async function geminiGenerate(
  prompt: string,
  options?: {
    temperature?: number;
    responseMimeType?: string;
    responseSchema?: unknown;
    signal?: AbortSignal;
  },
): Promise<string> {
  const apiKey = resolveApiKey();
  const { temperature = 0.2, responseMimeType = 'application/json', responseSchema } = options || {};

  let lastError: Error | null = null;

  for (const model of MODELS) {
    const url = `${BASE_URL}/${model}:generateContent?key=${apiKey}`;
    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        responseMimeType,
      },
    };
    if (responseSchema) {
      body.generationConfig = {
        ...body.generationConfig as Record<string, unknown>,
        responseSchema,
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: options?.signal || controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errData = await res.json().catch(() => null) as GeminiResponse | null;
        const msg = errData?.error?.message || `HTTP ${res.status}`;
        if (res.status === 404 || res.status === 400 || msg.toLowerCase().includes('not found') || msg.toLowerCase().includes('not supported')) {
          lastError = new Error(msg);
          continue;
        }
        throw new Error(msg);
      }

      const data = (await res.json()) as GeminiResponse;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty Gemini response');
      return text;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = lastError.message.toLowerCase();
      if (msg.includes('not found') || msg.includes('404') || msg.includes('400') || msg.includes('not supported')) {
        continue;
      }
      // For network errors / timeouts, try next model
      if (msg.includes('aborted') || msg.includes('timeout') || msg.includes('fetch')) {
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

// Keep the GoogleGenAI import for isGeminiConfigured compat
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: resolveApiKey() });

export function isGeminiConfigured(): boolean {
  return !!resolveApiKey();
}

// ===== Typo Detection Heuristic (pre-filter for batch cleanup) =====
// Detects common typo patterns to avoid sending clean words to Gemini
function looksLikeTypo(word: string): boolean {
  const w = word.toLowerCase().trim();
  if (!w) return false;
  // Repeated letter patterns: "protectt", "protectet", "verry", "accomodate"
  if (/(.)\1{2,}/.test(w)) return true; // 3+ same char in a row
  if (/([a-z])\1([a-z]?)\1/.test(w) && w.length > 4) return true; // alternating repeats like "tet"
  // Common misspelling patterns
  if (/ee$/.test(w) && !['bee', 'see', 'fee', 'tree', 'free', 'knee', 'agree', 'coffee', 'committee', 'employee'].includes(w)) {
    // unlikely terminal double-e except common words
  }
  return false;
}

// ===== Sentence Practice (unchanged, uses same centralized API) =====

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

function safeParseJSON(text: string): Record<string, unknown> {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
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

  const text = await geminiGenerate(prompt, {
    temperature: 0.4,
    responseMimeType: 'application/json',
    responseSchema,
  });

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

  const effectiveAlternatives = nativeAlternatives.length > 0
    ? nativeAlternatives
    : buildFallbackAlternatives(targetWord, wordType, meaning);

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
}

// ===== Single Vocab Validation =====

export interface VocabValidationResult {
  hasErrors: boolean;
  original: { word: string; meaning: string };
  corrected: {
    word: string;
    meaning: string;
    partOfSpeech: string;
    ipa: string;
  };
  isMeaningMismatch: boolean;
  notes: string[];
}

const vocabValidationSchema = {
  type: Type.OBJECT,
  properties: {
    hasErrors: { type: Type.BOOLEAN },
    original: {
      type: Type.OBJECT,
      properties: {
        word: { type: Type.STRING },
        meaning: { type: Type.STRING },
      },
      required: ['word', 'meaning'],
    },
    corrected: {
      type: Type.OBJECT,
      properties: {
        word: { type: Type.STRING },
        meaning: { type: Type.STRING },
        partOfSpeech: { type: Type.STRING },
        ipa: { type: Type.STRING },
      },
      required: ['word', 'meaning', 'partOfSpeech', 'ipa'],
    },
    isMeaningMismatch: { type: Type.BOOLEAN },
    notes: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['hasErrors', 'original', 'corrected', 'isMeaningMismatch', 'notes'],
};

export async function validateVocabWithGemini(params: {
  word: string;
  meaning: string;
  type: string;
}): Promise<VocabValidationResult> {
  const { word, meaning, type } = params;

  const prompt = `Act as a professional bilingual lexicographer (English - Vietnamese). Inspect the user's input:
- English input: ${word}
- Vietnamese meaning: ${meaning}
- User-provided part of speech: ${type || '(empty)'}

Analyze and return raw JSON strictly following this schema:
{
  "hasErrors": boolean,
  "original": { "word": "${word}", "meaning": "${meaning}" },
  "corrected": {
    "word": string,
    "meaning": string,
    "partOfSpeech": string,
    "ipa": string
  },
  "isMeaningMismatch": boolean,
  "notes": ["..."]
}

Rules:
- If the input is already correct, set hasErrors to false and still fill "corrected" with the correct values.
- Always provide IPA transcription.
- notes can be empty array if no errors.
- Keep notes concise and in Vietnamese.`;

  const text = await geminiGenerate(prompt, {
    temperature: 0.2,
    responseMimeType: 'application/json',
    responseSchema: vocabValidationSchema,
  });

  const parsed = safeParseJSON(text);

  return {
    hasErrors: (parsed.hasErrors as boolean) ?? false,
    original: {
      word: ((parsed.original as { word: string })?.word) || word,
      meaning: ((parsed.original as { meaning: string })?.meaning) || meaning,
    },
    corrected: {
      word: (parsed.corrected as { word: string })?.word || word,
      meaning: (parsed.corrected as { meaning: string })?.meaning || meaning,
      partOfSpeech: (parsed.corrected as { partOfSpeech: string })?.partOfSpeech || type || '',
      ipa: (parsed.corrected as { ipa: string })?.ipa || '',
    },
    isMeaningMismatch: (parsed.isMeaningMismatch as boolean) ?? false,
    notes: (parsed.notes as string[]) || [],
  };
}

// ===== Batch Vocab Audit (chunked, 25 words per API call) =====

export interface BatchAuditItem {
  vocabId: string;
  original: { word: string; meaning: string; type: string };
  corrected: { word: string; meaning: string; partOfSpeech: string; ipa: string };
  notes: string[];
}

export interface BatchAuditResult {
  items: BatchAuditItem[];
  totalScanned: number;
  totalErrors: number;
}

const CHUNK_SIZE = 25;

const batchAuditSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      originalWord: { type: Type.STRING },
      correctedWord: { type: Type.STRING },
      correctedMeaning: { type: Type.STRING },
      partOfSpeech: { type: Type.STRING },
      ipa: { type: Type.STRING },
      hasErrors: { type: Type.BOOLEAN },
      notes: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['originalWord', 'correctedWord', 'correctedMeaning', 'partOfSpeech', 'ipa', 'hasErrors', 'notes'],
  },
};

async function auditChunk(
  chunk: Array<{ id: string; word: string; meaning: string; type: string }>,
): Promise<BatchAuditItem[]> {
  if (chunk.length === 0) return [];

  const entriesText = chunk
    .map((e, i) => `${i + 1}. English: "${e.word}", Vietnamese: "${e.meaning}", Part of speech: "${e.type || ''}"`)
    .join('\n');

  const prompt = `You are an automated dictionary cleaner. For each entry below, check for typos in English/Vietnamese, meaning mismatches, and wrong part of speech.

Input entries:
${entriesText}

Return a raw JSON array with exactly ${chunk.length} entries in the same order:
[
  {
    "originalWord": "the original English word",
    "correctedWord": "corrected English spelling (same as original if no typo)",
    "correctedMeaning": "corrected Vietnamese meaning (same as original if no error)",
    "partOfSpeech": "n | v | adj | adv | phr",
    "ipa": "IPA transcription",
    "hasErrors": true/false,
    "notes": ["Vietnamese note explaining correction, or empty array"]
  }
]

Rules:
- Fix typos like "protectt" -> "protect", "protectet" -> "protect".
- If no errors, set hasErrors to false and still fill all fields with correct values.
- Keep notes concise, in Vietnamese. Empty array if no errors.`;

  try {
    const text = await geminiGenerate(prompt, {
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: batchAuditSchema,
    });

    let parsed: Array<{
      originalWord: string;
      correctedWord: string;
      correctedMeaning: string;
      partOfSpeech: string;
      ipa: string;
      hasErrors: boolean;
      notes: string[];
    }>;

    try {
      parsed = JSON.parse(text);
    } catch {
      // Try extracting JSON array
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];
      parsed = JSON.parse(match[0]);
    }

    const items: BatchAuditItem[] = [];
    for (let i = 0; i < chunk.length; i++) {
      const item = parsed[i];
      if (!item) continue;

      const wordChanged = (item.correctedWord || '').toLowerCase() !== chunk[i].word.toLowerCase();
      const meaningChanged = (item.correctedMeaning || '') !== chunk[i].meaning;
      const typeChanged = (item.partOfSpeech || '').toLowerCase() !== (chunk[i].type || '').toLowerCase();

      if (item.hasErrors || wordChanged || meaningChanged || typeChanged) {
        items.push({
          vocabId: chunk[i].id,
          original: { word: chunk[i].word, meaning: chunk[i].meaning, type: chunk[i].type },
          corrected: {
            word: item.correctedWord || chunk[i].word,
            meaning: item.correctedMeaning || chunk[i].meaning,
            partOfSpeech: item.partOfSpeech || chunk[i].type || '',
            ipa: item.ipa || '',
          },
          notes: item.notes || [],
        });
      }
    }

    return items;
  } catch {
    // Skip failed chunks, return empty
    return [];
  }
}

export async function batchAuditVocabWithGemini(
  vocabs: Array<{ id: string; word: string; meaning: string; type: string }>,
  onProgress?: (scanned: number, total: number) => void,
): Promise<BatchAuditResult> {
  const items: BatchAuditItem[] = [];
  let scanned = 0;
  const total = vocabs.length;

  // Process in chunks of CHUNK_SIZE to avoid token limits and timeouts
  for (let i = 0; i < vocabs.length; i += CHUNK_SIZE) {
    const chunk = vocabs.slice(i, i + CHUNK_SIZE);
    const chunkItems = await auditChunk(chunk);
    items.push(...chunkItems);

    scanned += chunk.length;
    onProgress?.(scanned, total);
  }

  return {
    items,
    totalScanned: scanned,
    totalErrors: items.length,
  };
}

// ===== Auto-Normalization (silent, batch single-call) =====

export interface NormalizedVocabEntry {
  originalWord: string;
  word: string;
  meaning: string;
  partOfSpeech: string;
  ipa: string;
  wasAutoCorrected: boolean;
  correctionNote: string;
}

const batchNormalizeSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      originalWord: { type: Type.STRING },
      word: { type: Type.STRING },
      meaning: { type: Type.STRING },
      partOfSpeech: { type: Type.STRING },
      ipa: { type: Type.STRING },
      wasAutoCorrected: { type: Type.BOOLEAN },
      correctionNote: { type: Type.STRING },
    },
    required: ['originalWord', 'word', 'meaning', 'partOfSpeech', 'ipa', 'wasAutoCorrected', 'correctionNote'],
  },
};

export async function autoNormalizeVocabBatch(
  entries: Array<{ word: string; meaning: string; type?: string }>,
): Promise<NormalizedVocabEntry[]> {
  if (entries.length === 0) return [];

  // Process in chunks to avoid token overload
  const results: NormalizedVocabEntry[] = [];

  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunk = entries.slice(i, i + CHUNK_SIZE);

    const entriesText = chunk
      .map((e, idx) => `${idx + 1}. English: "${e.word}", Vietnamese: "${e.meaning}", Part of speech: "${e.type || ''}"`)
      .join('\n');

    const prompt = `You are an automated dictionary cleaner. For each input entry below, silently fix typos in both English and Vietnamese, correct mismatches, and standardize the entry.

Input entries:
${entriesText}

Return a raw JSON array matching this exact schema:
[
  {
    "originalWord": "raw user input",
    "word": "Corrected English word (e.g., 'protectt' -> 'protect')",
    "meaning": "Accurate, natural Vietnamese translation",
    "partOfSpeech": "n | v | adj | adv | phr",
    "ipa": "Standard IPA phonetic transcription",
    "wasAutoCorrected": boolean,
    "correctionNote": "Short explanation if changed, empty string if no correction needed"
  }
]

Rules:
- Return exactly ${chunk.length} entries, one for each input, in the same order.
- If an entry is already correct, set wasAutoCorrected to false and still fill all fields with the correct values.
- Always provide IPA transcription.
- Keep correctionNote in Vietnamese, concise. Empty string if no correction.`;

    try {
      const text = await geminiGenerate(prompt, {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: batchNormalizeSchema,
      });

      let parsed: NormalizedVocabEntry[];
      try {
        parsed = JSON.parse(text);
      } catch {
        const match = text.match(/\[[\s\S]*\]/);
        if (!match) throw new Error('No JSON array found');
        parsed = JSON.parse(match[0]);
      }

      // Map results, pad with originals if needed
      for (let j = 0; j < chunk.length; j++) {
        const item = parsed[j];
        if (!item) {
          results.push({
            originalWord: chunk[j].word,
            word: chunk[j].word,
            meaning: chunk[j].meaning,
            partOfSpeech: chunk[j].type || '',
            ipa: '',
            wasAutoCorrected: false,
            correctionNote: '',
          });
        } else {
          results.push({
            originalWord: chunk[j].word,
            word: item.word || chunk[j].word,
            meaning: item.meaning || chunk[j].meaning,
            partOfSpeech: item.partOfSpeech || chunk[j].type || '',
            ipa: item.ipa || '',
            wasAutoCorrected: item.wasAutoCorrected ?? false,
            correctionNote: item.correctionNote || '',
          });
        }
      }
    } catch {
      // On chunk failure, return originals for this chunk
      for (const entry of chunk) {
        results.push({
          originalWord: entry.word,
          word: entry.word,
          meaning: entry.meaning,
          partOfSpeech: entry.type || '',
          ipa: '',
          wasAutoCorrected: false,
          correctionNote: '',
        });
      }
    }
  }

  return results;
}

// Export the ai instance for backward compatibility
export { ai };

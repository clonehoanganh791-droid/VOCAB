// Dynamic grammar evaluator for sentence building practice
// Provides accurate, context-aware analysis without false positives

export type ErrorType = 'Spelling' | 'Grammar' | 'Structure' | 'Collocation';

export interface DetectedError {
  type: ErrorType;
  incorrectPart: string;
  correction: string;
  explanationVi: string;
}

export interface NativeAlternative {
  sentence: string;
  translation: string;
  explanation: string;
}

export interface GrammarError {
  message: string;
  explanation: string;
}

export interface GrammarEvaluation {
  accuracy: number;
  isSpellingCorrect: boolean;
  isGrammarCorrect: boolean;
  isNatural: boolean;
  detectedErrors: DetectedError[];
  detailedAnalysisVi: string;
  nativeAlternatives: NativeAlternative[];
  grammarRulesBreakdown: string;
  // Legacy compat fields used by local fallback
  errors: { message: string; explanation: string }[];
  feedback: string;
  improved: string;
  improvedTranslation: string;
  improvedSentences: { en: string; vi: string }[];
  grammarStructure: string;
}

interface EvaluateParams {
  sentence: string;
  targetWord: string;
  wordType: string;
  meaning: string;
  lang: 'en' | 'vi';
}

// Common uncountable nouns that don't take "a/an"
const UNCOUNTABLE_NOUNS = new Set([
  'water', 'money', 'time', 'information', 'advice', 'knowledge', 'research',
  'homework', 'evidence', 'furniture', 'luggage', 'equipment', 'music',
  'weather', 'news', 'progress', 'traffic', 'rice', 'bread', 'milk',
  'sugar', 'salt', 'tea', 'coffee', 'love', 'happiness', 'health', 'beauty',
  'nature', 'education', 'experience', 'confidence', 'patience', 'energy',
  'environment', 'pollution', 'violence', 'freedom', 'truth', 'wisdom',
  'courage', 'luck', 'success', 'work', 'help', 'food', 'fruit',
]);

// Common irregular plural nouns
const IRREGULAR_PLURALS: Record<string, string> = {
  'child': 'children', 'person': 'people', 'man': 'men', 'woman': 'women',
  'foot': 'feet', 'tooth': 'teeth', 'mouse': 'mice', 'goose': 'geese',
  'ox': 'oxen', 'leaf': 'leaves', 'life': 'lives', 'knife': 'knives',
  'wife': 'wives', 'half': 'halves', 'self': 'selves', 'calf': 'calves',
  'loaf': 'loaves', 'thesis': 'theses', 'analysis': 'analyses',
  'crisis': 'crises', 'phenomenon': 'phenomena', 'criterion': 'criteria',
};

// Common prepositions
const PREPOSITIONS = new Set([
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'about',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'among', 'under', 'over', 'against', 'without', 'within',
  'across', 'along', 'behind', 'beyond', 'despite', 'except', 'toward',
]);

// Common verbs that need objects (transitive)
const TRANSITIVE_VERBS = new Set([
  'buy', 'get', 'make', 'do', 'have', 'take', 'give', 'find', 'tell',
  'ask', 'use', 'need', 'want', 'like', 'love', 'hate', 'eat', 'drink',
  'read', 'write', 'see', 'hear', 'know', 'think', 'believe', 'feel',
  'overcome', 'solve', 'build', 'create', 'develop', 'improve', 'manage',
  'achieve', 'reach', 'deliver', 'provide', 'require', 'offer', 'accept',
]);

// Words that are always capitalized
const ALWAYS_CAPITALIZED = new Set(['i']);

// Check if a word is likely a singular countable noun needing an article
function isSingularCountableNoun(word: string): boolean {
  const lower = word.toLowerCase();
  if (UNCOUNTABLE_NOUNS.has(lower)) return false;
  if (IRREGULAR_PLURALS[lower]) return false; // it's already irregular plural
  // Ends with 's' - likely plural
  if (lower.endsWith('s') && !lower.endsWith('ss') && !lower.endsWith('us') && !lower.endsWith('is')) return false;
  // Common suffixes suggesting non-nouns
  if (lower.endsWith('ly') || lower.endsWith('ing') || lower.endsWith('ed') || lower.endsWith('tion')) return false;
  return true;
}

// Detect if a word starts with a vowel sound (for a vs an)
function startsWithVowelSound(word: string): boolean {
  if (!word) return false;
  const first = word[0].toLowerCase();
  // Handle silent 'h' cases
  const silentH = ['honest', 'hour', 'heir', 'honor', 'honour'];
  if (silentH.some((h) => word.toLowerCase().startsWith(h))) return true;
  return ['a', 'e', 'i', 'o', 'u'].includes(first);
}

// Tokenize sentence into words with positions
interface Token {
  word: string;
  lower: string;
  index: number;
}

function tokenize(sentence: string): Token[] {
  const tokens: Token[] = [];
  const regex = /\b([\w'-]+)\b/g;
  let match;
  while ((match = regex.exec(sentence)) !== null) {
    tokens.push({
      word: match[0],
      lower: match[0].toLowerCase(),
      index: match.index,
    });
  }
  return tokens;
}

// Parse a raw target word into a list of valid target options.
// Handles slash separators, parenthetical part-of-speech labels, and multi-word phrases.
// e.g. "Open mind (n) / Open-minded" -> ["open mind", "open-minded"]
export function parseTargetOptions(targetWord: string): string[] {
  let cleaned = targetWord.trim();

  // Remove all parenthetical content: (n), (v), (adj), (adv), etc.
  cleaned = cleaned.replace(/\s*\([^)]*\)\s*/g, ' ');

  // Split on slash separators (but not hyphens within words)
  const parts = cleaned.split(/\s*\/\s*/);

  const options: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim().toLowerCase();
    if (trimmed && trimmed.length > 0) {
      options.push(trimmed);
    }
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const opt of options) {
    if (!seen.has(opt)) {
      seen.add(opt);
      unique.push(opt);
    }
  }

  return unique.length > 0 ? unique : [targetWord.trim().toLowerCase()];
}

// Check: target word present? (supports multi-option matching)
function checkTargetWord(
  sentence: string,
  targetWord: string,
  lang: 'en' | 'vi',
): GrammarError[] {
  const errors: GrammarError[] = [];
  const options = parseTargetOptions(targetWord);
  const sentenceLower = sentence.toLowerCase();

  // Check if at least one target option is present in the sentence
  let found = false;
  for (const option of options) {
    const escaped = option.replace(/[.*+?^${}()|[\]\\]/g, '\$&');
    // For multi-word phrases, match the phrase as a substring (words separated by spaces)
    // For single words, match as a whole word with optional suffixes
    if (option.includes(' ') || option.includes('-')) {
      // Multi-word or hyphenated phrase: match as substring, case-insensitive
      if (sentenceLower.includes(option)) {
        found = true;
        break;
      }
      // Also try without hyphens (e.g., "open-minded" could appear as "open mind")
      const noHyphen = option.replace(/-/g, ' ');
      if (noHyphen !== option && sentenceLower.includes(noHyphen)) {
        found = true;
        break;
      }
    } else {
      // Single word: match whole word with optional inflection suffixes
      const regex = new RegExp(`\\b${escaped}(?:s|es|ed|ing|d|er|est|ly)?\\b`, 'i');
      if (regex.test(sentence)) {
        found = true;
        break;
      }
    }
  }

  if (!found) {
    const displayWord = options.length > 1 ? options.join(' / ') : targetWord;
    errors.push({
      message: lang === 'en'
        ? `Missing target word "${displayWord}"`
        : `Thiếu từ mục tiêu "${displayWord}"`,
      explanation: lang === 'en'
        ? `Your sentence must include at least one form of: ${options.map((o) => `"${o}"`).join(' or ')}.`
        : `Câu của bạn phải chứa ít nhất một dạng: ${options.map((o) => `"${o}"`).join(' hoặc ')}.`,
    });
  }
  return errors;
}

// Check: first letter capitalization
function checkFirstCapital(
  sentence: string,
  lang: 'en' | 'vi',
): GrammarError[] {
  const errors: GrammarError[] = [];
  const trimmed = sentence.trim();
  if (trimmed.length > 0 && trimmed[0] !== trimmed[0].toUpperCase()) {
    errors.push({
      message: lang === 'en'
        ? 'Sentence should start with a capital letter'
        : 'Câu phải bắt đầu bằng chữ hoa',
      explanation: lang === 'en'
        ? 'The first word of a sentence should always be capitalized.'
        : 'Từ đầu tiên trong câu luôn phải viết hoa.',
    });
  }
  return errors;
}

// Check: standalone lowercase "i" pronoun — ONLY flag actual lowercase "i", never "I"
function checkLowercaseI(
  sentence: string,
  lang: 'en' | 'vi',
): GrammarError[] {
  const errors: GrammarError[] = [];
  const tokens = tokenize(sentence);
  for (const token of tokens) {
    if (token.lower === 'i' && token.word === 'i') {
      errors.push({
        message: lang === 'en'
          ? `The pronoun "I" should be capitalized`
          : `Đại từ "I" phải viết hoa`,
        explanation: lang === 'en'
          ? 'The pronoun "I" is always capitalized in English, regardless of position.'
          : 'Đại từ "I" luôn viết hoa trong tiếng Anh, bất kể vị trí.',
      });
    }
  }
  return errors;
}

// Check: ending punctuation
function checkEndingPunctuation(
  sentence: string,
  lang: 'en' | 'vi',
): GrammarError[] {
  const errors: GrammarError[] = [];
  const trimmed = sentence.trim();
  if (trimmed.length > 0 && !/[.!?]$/.test(trimmed)) {
    errors.push({
      message: lang === 'en'
        ? 'Missing ending punctuation'
        : 'Thiếu dấu kết thúc câu',
      explanation: lang === 'en'
        ? 'A sentence should end with a period (.), exclamation mark (!), or question mark (?).'
        : 'Câu phải kết thúc bằng dấu chấm (.), dấu chấm than (!), hoặc dấu hỏi (?).',
    });
  }
  return errors;
}

// Check: double spaces
function checkDoubleSpaces(
  sentence: string,
  lang: 'en' | 'vi',
): GrammarError[] {
  const errors: GrammarError[] = [];
  if (/\s{2,}/.test(sentence)) {
    errors.push({
      message: lang === 'en'
        ? 'Extra spaces between words'
        : 'Khoảng trắng thừa giữa các từ',
      explanation: lang === 'en'
        ? 'Use only a single space between words.'
        : 'Chỉ dùng một khoảng trắng giữa các từ.',
    });
  }
  return errors;
}

// Check: missing articles before singular countable nouns
function checkMissingArticles(
  sentence: string,
  lang: 'en' | 'vi',
  targetOptions: string[] = [],
): GrammarError[] {
  const errors: GrammarError[] = [];
  const tokens = tokenize(sentence);
  const sentenceLower = sentence.toLowerCase();
  const articles = new Set(['a', 'an', 'the']);
  const pronouns = new Set(['this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'some', 'any', 'no', 'every', 'each', 'all', 'both', 'several', 'many', 'much', 'few', 'little']);
  const beVerbs = new Set(['is', 'are', 'was', 'were', 'be', 'been', 'being', 'am']);
  const auxVerbs = new Set(['have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'must', 'may', 'might', 'shall']);

  // Build a set of all words that are part of any target option phrase
  const targetWords = new Set<string>();
  for (const opt of targetOptions) {
    for (const w of opt.split(/[-\s]+/)) {
      if (w) targetWords.add(w.toLowerCase());
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const lower = token.lower;

    // Skip if not a potential noun (skip verbs, adjectives, etc. by checking context)
    // Only check words that look like nouns: not in known verb/adjective sets
    if (articles.has(lower)) continue;
    if (pronouns.has(lower)) continue;
    if (beVerbs.has(lower)) continue;
    if (auxVerbs.has(lower)) continue;
    if (PREPOSITIONS.has(lower)) continue;
    if (ALWAYS_CAPITALIZED.has(lower)) continue;
    if (!isSingularCountableNoun(lower)) continue;

    // Skip words that are part of a target phrase — the user is practicing
    // using the target word, so we don't flag it for missing articles
    if (targetWords.has(lower)) continue;

    // Check if this token is part of a multi-word target phrase in the sentence
    let isPartOfTargetPhrase = false;
    for (const opt of targetOptions) {
      if (opt.includes(' ') || opt.includes('-')) {
        const optNoHyphen = opt.replace(/-/g, ' ');
        if (sentenceLower.includes(optNoHyphen) || sentenceLower.includes(opt)) {
          // Check if this token is within the target phrase span
          const optWords = optNoHyphen.split(/\s+/);
          if (optWords.includes(lower)) {
            isPartOfTargetPhrase = true;
            break;
          }
        }
      }
    }
    if (isPartOfTargetPhrase) continue;

    // Skip common adjectives/adverbs
    if (lower.endsWith('ly')) continue;
    if (lower === 'not' || lower === 'very' || lower === 'too' || lower === 'so') continue;

    // Check if this word is preceded by an article, pronoun, or possessive
    const prev = i > 0 ? tokens[i - 1] : null;
    const prevLower = prev?.lower ?? '';

    // If preceded by article or determiner, it's fine
    if (articles.has(prevLower) || pronouns.has(prevLower)) continue;

    // If preceded by a preposition, might be part of a phrase — skip
    if (PREPOSITIONS.has(prevLower)) continue;

    // If preceded by "and" or "or", check the word before that
    if (prevLower === 'and' || prevLower === 'or') {
      const prevPrev = i > 1 ? tokens[i - 2].lower : '';
      if (articles.has(prevPrev) || pronouns.has(prevPrev)) continue;
    }

    // If preceded by an adjective, check if the adjective has an article
    // e.g., "the big house" is fine, but "big house" needs "a big house"
    // Check if previous word looks like an adjective (not a noun/verb/prep)
    if (prev && !articles.has(prevLower) && !pronouns.has(prevLower) &&
        !PREPOSITIONS.has(prevLower) && !beVerbs.has(prevLower) &&
        !auxVerbs.has(prevLower) && !TRANSITIVE_VERBS.has(prevLower) &&
        prevLower !== 'and' && prevLower !== 'or' &&
        !isSingularCountableNoun(prevLower) === false) {
      // Previous word is a noun — could be compound noun, skip
      continue;
    }

    // If this noun is the subject and comes right after a verb, skip
    // e.g., "I have problem" — "problem" after transitive verb needs article
    if (TRANSITIVE_VERBS.has(prevLower)) {
      // This is a direct object of a transitive verb — needs article
      const article = startsWithVowelSound(lower) ? 'an' : 'a';
      errors.push({
        message: lang === 'en'
          ? `Missing article before "${token.word}"`
          : `Thiếu mạo từ trước "${token.word}"`,
        explanation: lang === 'en'
          ? `"${token.word}" is a singular countable noun. Use "${article} ${token.word}" or make it plural ("${token.word}s").`
          : `"${token.word}" là danh từ đếm được số ít. Cần dùng "${article} ${token.word}" hoặc chuyển sang số nhiều ("${token.word}s").`,
      });
      continue;
    }

    // If this noun is at the start or after a verb "is/are" etc.
    // e.g., "Problem is difficult" -> "The problem is difficult"
    if (i === 0 || beVerbs.has(prevLower)) {
      const article = startsWithVowelSound(lower) ? 'an' : 'the';
      errors.push({
        message: lang === 'en'
          ? `Missing article before "${token.word}"`
          : `Thiếu mạo từ trước "${token.word}"`,
        explanation: lang === 'en'
          ? `"${token.word}" is a singular countable noun and needs a determiner. Try "${article} ${token.word}".`
          : `"${token.word}" là danh từ đếm được số ít và cần mạo từ. Dùng "${article} ${token.word}".`,
      });
    }
  }

  return errors;
}

// Check: subject-verb agreement (basic)
function checkSubjectVerbAgreement(
  sentence: string,
  lang: 'en' | 'vi',
): GrammarError[] {
  const errors: GrammarError[] = [];
  const tokens = tokenize(sentence);
  const beVerbs = new Set(['is', 'are', 'was', 'were', 'am']);

  for (let i = 0; i < tokens.length - 1; i++) {
    const curr = tokens[i];
    const next = tokens[i + 1];

    // "I are" -> "I am"
    if (curr.lower === 'i' && next.lower === 'are') {
      errors.push({
        message: lang === 'en'
          ? '"I are" should be "I am"'
          : '"I are" phải là "I am"',
        explanation: lang === 'en'
          ? 'The subject "I" always takes "am" in present tense, not "are".'
          : 'Chủ ngữ "I" luôn đi với "am" ở thì hiện tại, không phải "are".',
      });
    }

    // "He/she/it are" -> "He/she/it is"
    if (['he', 'she', 'it'].includes(curr.lower) && next.lower === 'are') {
      errors.push({
        message: lang === 'en'
          ? `"${curr.word} are" should be "${curr.word} is"`
          : `"${curr.word} are" phải là "${curr.word} is"`,
        explanation: lang === 'en'
          ? `Singular subjects (he, she, it) take "is", not "are".`
          : `Chủ ngữ số ít (he, she, it) đi với "is", không phải "are".`,
      });
    }

    // "They/we/you is" -> "They/we/you are"
    if (['they', 'we', 'you'].includes(curr.lower) && next.lower === 'is') {
      errors.push({
        message: lang === 'en'
          ? `"${curr.word} is" should be "${curr.word} are"`
          : `"${curr.word} is" phải là "${curr.word} are"`,
        explanation: lang === 'en'
          ? `Plural subjects (they, we, you) take "are", not "is".`
          : `Chủ ngữ số nhiều (they, we, you) đi với "are", không phải "is".`,
      });
    }
  }

  return errors;
}

// Check: common contraction errors
function checkContractions(
  sentence: string,
  lang: 'en' | 'vi',
): GrammarError[] {
  const errors: GrammarError[] = [];
  // Check for "dont", "cant", "wont", "didnt", "isnt", "arent", "wasnt", "werent" without apostrophe
  const contractionPatterns: Array<[RegExp, string, string]> = [
    [/\bdont\b/i, "don't", lang === 'en' ? 'Use "don\'t" with an apostrophe' : 'Dùng "don\'t" có dấu phẩy trên'],
    [/\bcant\b/i, "can't", lang === 'en' ? 'Use "can\'t" with an apostrophe' : 'Dùng "can\'t" có dấu phẩy trên'],
    [/\bwont\b/i, "won't", lang === 'en' ? 'Use "won\'t" with an apostrophe' : 'Dùng "won\'t" có dấu phẩy trên'],
    [/\bdidnt\b/i, "didn't", lang === 'en' ? 'Use "didn\'t" with an apostrophe' : 'Dùng "didn\'t" có dấu phẩy trên'],
    [/\bisnt\b/i, "isn't", lang === 'en' ? 'Use "isn\'t" with an apostrophe' : 'Dùng "isn\'t" có dấu phẩy trên'],
    [/\barent\b/i, "aren't", lang === 'en' ? 'Use "aren\'t" with an apostrophe' : 'Dùng "aren\'t" có dấu phẩy trên'],
    [/\bim\b/i, "I'm", lang === 'en' ? 'Use "I\'t" with an apostrophe' : 'Dùng "I\'m" có dấu phẩy trên'],
  ];

  for (const [regex, correct, msg] of contractionPatterns) {
    if (regex.test(sentence)) {
      // Make sure the correctly spelled version isn't also present
      const correctEscaped = correct.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const correctRegex = new RegExp(`\\b${correctEscaped}\\b`, 'i');
      if (!correctRegex.test(sentence)) {
        errors.push({
          message: msg,
          explanation: lang === 'en'
            ? `The contraction "${correct}" requires an apostrophe.`
            : `Từ viết tắt "${correct}" cần có dấu phẩy trên (apostrophe).`,
        });
      }
    }
  }

  return errors;
}

// Check: tense consistency (basic — mixed past/present in same clause)
function checkTenseConsistency(
  sentence: string,
  lang: 'en' | 'vi',
): GrammarError[] {
  const errors: GrammarError[] = [];
  const tokens = tokenize(sentence);
  const pastVerbs: string[] = [];
  const presentVerbs: string[] = [];

  const pastPattern = /\b\w+ed\b/i;
  const presentPattern = /\b\w+s\b/i;

  for (const token of tokens) {
    if (token.lower.endsWith('ed') && token.lower.length > 3) {
      pastVerbs.push(token.word);
    }
  }

  // Only flag if there's a clear mix of past and present tense verbs in a short sentence
  // This is a heuristic check — avoid false positives
  if (pastVerbs.length > 0) {
    for (const token of tokens) {
      // Check for present tense verb forms mixed with past
      if (PRESENT_VERBS.has(token.lower) && pastVerbs.length > 0) {
        // Skip if it's a common structure like "has worked" (present perfect)
        const prev = tokens.indexOf(token) > 0 ? tokens[tokens.indexOf(token) - 1].lower : '';
        if (prev === 'have' || prev === 'has' || prev === 'had') continue;
        // Skip "is/was + past participle" (passive voice)
        if (BE_VERBS.has(token.lower)) continue;
      }
    }
  }

  void presentPattern;
  void lang;

  return errors;
}

const BE_VERBS = new Set(['is', 'are', 'was', 'were', 'be', 'been', 'being', 'am']);
const PRESENT_VERBS = new Set(['goes', 'does', 'makes', 'takes', 'gives', 'finds', 'tells', 'asks', 'uses', 'needs', 'wants', 'likes', 'loves', 'hates', 'eats', 'drinks', 'reads', 'writes', 'sees', 'hears', 'knows', 'thinks', 'believes', 'feels', 'overcomes', 'solves', 'builds', 'creates', 'develops', 'improves', 'manages', 'achieves', 'reaches', 'delivers', 'provides', 'requires', 'offers', 'accepts']);

// Build the improved/model sentence
function buildModelSentence(
  sentence: string,
  targetWord: string,
  wordType: string,
  meaning: string,
  lang: 'en' | 'vi',
): { improved: string; translation: string; structure: string } {
  let improved = sentence.trim();

  // Fix first letter capitalization
  if (improved.length > 0) {
    improved = improved[0].toUpperCase() + improved.slice(1);
  }

  // Fix lowercase "i" -> "I" (only actual lowercase, not already uppercase)
  improved = improved.replace(/\bi\b/g, 'I');
  improved = improved.replace(/\bi'm\b/gi, "I'm");
  improved = improved.replace(/\bi'll\b/gi, "I'll");
  improved = improved.replace(/\bi've\b/gi, "I've");
  improved = improved.replace(/\bi'd\b/gi, "I'd");

  // Fix contractions without apostrophes
  improved = improved.replace(/\bdont\b/gi, "don't");
  improved = improved.replace(/\bcant\b/gi, "can't");
  improved = improved.replace(/\bwont\b/gi, "won't");
  improved = improved.replace(/\bdidnt\b/gi, "didn't");
  improved = improved.replace(/\bisnt\b/gi, "isn't");
  improved = improved.replace(/\barent\b/gi, "aren't");

  // Fix double spaces
  improved = improved.replace(/\s{2,}/g, ' ');

  // Add ending punctuation
  if (improved.length > 0 && !/[.!?]$/.test(improved)) {
    improved += '.';
  }

  // Build a simple Vietnamese translation hint
  const translation = lang === 'vi'
    ? `Câu mẫu: "${improved}" (Nghĩa: ${meaning})`
    : `Model: "${improved}" (Meaning: ${meaning})`;

  // Grammar structure breakdown
  const structureParts: string[] = [];
  const tokens = tokenize(improved);
  if (tokens.length > 0) {
    const first = tokens[0].lower;
    if (first === 'i' || first === 'he' || first === 'she' || first === 'it' || first === 'they' || first === 'we' || first === 'you') {
      structureParts.push(lang === 'vi' ? 'Chủ ngữ (Subject)' : 'Subject');
    } else {
      structureParts.push(lang === 'vi' ? 'Chủ ngữ (Subject)' : 'Subject');
    }
    structureParts.push(lang === 'vi' ? 'Động từ (Verb)' : 'Verb');
    if (tokens.length > 2) {
      structureParts.push(lang === 'vi' ? 'Bổ ngữ (Object/Complement)' : 'Object/Complement');
    }
  }

  const structureLabel = lang === 'vi' ? 'Cấu trúc' : 'Structure';
  const structure = `${structureLabel}: ${structureParts.join(' + ')}`;

  // Use wordType in the structure description
  void wordType;

  return { improved, translation, structure };
}

export function evaluateSentence({ sentence, targetWord, wordType, meaning, lang }: EvaluateParams): GrammarEvaluation {
  const trimmed = sentence.trim();

  if (!trimmed) {
    return {
      accuracy: 0,
      isSpellingCorrect: false,
      isGrammarCorrect: false,
      isNatural: false,
      detectedErrors: [],
      detailedAnalysisVi: lang === 'en' ? 'Please write a sentence.' : 'Vui lòng viết một câu.',
      nativeAlternatives: [],
      grammarRulesBreakdown: '',
      errors: [],
      feedback: lang === 'en' ? 'Please write a sentence.' : 'Vui lòng viết một câu.',
      improved: '',
      improvedTranslation: '',
      improvedSentences: [],
      grammarStructure: '',
    };
  }

  // Collect all errors
  const allErrors: GrammarError[] = [];
  const targetOptions = parseTargetOptions(targetWord);
  allErrors.push(...checkTargetWord(trimmed, targetWord, lang));
  allErrors.push(...checkFirstCapital(trimmed, lang));
  allErrors.push(...checkLowercaseI(trimmed, lang));
  allErrors.push(...checkEndingPunctuation(trimmed, lang));
  allErrors.push(...checkDoubleSpaces(trimmed, lang));
  allErrors.push(...checkMissingArticles(trimmed, lang, targetOptions));
  allErrors.push(...checkSubjectVerbAgreement(trimmed, lang));
  allErrors.push(...checkContractions(trimmed, lang));
  allErrors.push(...checkTenseConsistency(trimmed, lang));

  // Sentence length check
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount < 3) {
    allErrors.push({
      message: lang === 'en'
        ? 'Sentence is too short'
        : 'Câu quá ngắn',
      explanation: lang === 'en'
        ? 'Try writing a more complete sentence with at least 3 words.'
        : 'Hãy viết câu đầy đủ hơn, ít nhất 3 từ.',
    });
  }

  // Calculate accuracy dynamically based on error severity
  let accuracy = 100;
  for (const err of allErrors) {
    // Missing target word is a major error
    if (err.message.includes('target word') || err.message.includes('từ mục tiêu')) {
      accuracy -= 30;
    } else if (err.message.includes('article') || err.message.includes('mạo từ')) {
      accuracy -= 12;
    } else if (err.message.includes('Subject-verb') || err.message.includes('hòa hợp') || err.message.includes('should be') || err.message.includes('phải là')) {
      accuracy -= 15;
    } else if (err.message.includes('too short') || err.message.includes('quá ngắn')) {
      accuracy -= 15;
    } else if (err.message.includes('capital') || err.message.includes('chữ hoa') || err.message.includes('viết hoa')) {
      accuracy -= 8;
    } else if (err.message.includes('punctuation') || err.message.includes('dấu kết thúc')) {
      accuracy -= 5;
    } else if (err.message.includes('apostrophe') || err.message.includes('dấu phẩy')) {
      accuracy -= 8;
    } else if (err.message.includes('spaces') || err.message.includes('khoảng trắng')) {
      accuracy -= 3;
    } else {
      accuracy -= 10;
    }
  }

  accuracy = Math.max(0, Math.min(100, accuracy));

  // Build model sentence
  const model = buildModelSentence(trimmed, targetWord, wordType, meaning, lang);

  // Build feedback text
  const displayWord = targetOptions.length > 1 ? targetOptions.join(' / ') : targetWord;
  let feedback: string;
  if (allErrors.length === 0 && wordCount >= 3) {
    feedback = lang === 'en'
      ? `Excellent! You used "${displayWord}" correctly in a well-formed sentence.`
      : `Xuất sắc! Bạn đã dùng "${displayWord}" đúng trong một câu chuẩn.`;
  } else {
    // List errors as feedback
    feedback = allErrors.map((e) => `• ${e.message}`).join('\n');
  }

  const detectedErrors: DetectedError[] = allErrors.map((e) => ({
    type: 'Grammar' as ErrorType,
    incorrectPart: e.message,
    correction: e.explanation,
    explanationVi: e.explanation,
  }));

  return {
    accuracy,
    isSpellingCorrect: true,
    isGrammarCorrect: allErrors.length === 0,
    isNatural: allErrors.length === 0,
    detectedErrors,
    detailedAnalysisVi: feedback,
    nativeAlternatives: [{ sentence: model.improved, translation: model.translation, explanation: '' }],
    grammarRulesBreakdown: model.structure,
    errors: allErrors,
    feedback,
    improved: model.improved,
    improvedTranslation: model.translation,
    improvedSentences: [{ en: model.improved, vi: model.translation }],
    grammarStructure: model.structure,
  };
}

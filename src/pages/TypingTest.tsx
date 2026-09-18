import { useState, useRef, useEffect } from 'react';
import { Keyboard, CheckCircle2, XCircle, RotateCcw, ChevronRight, Lightbulb, Trophy, Volume2 } from 'lucide-react';
import { useVocab } from '@/context/VocabContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/components/Toast';
import { speak, speedOptions, getGlobalRate, setGlobalRate } from '@/lib/speech';
import { addPracticeRecord } from '@/lib/storage';
import type { Vocabulary } from '@/lib/types';
import type { TranslationKey } from '@/lib/i18n';

const QUESTION_COUNTS = [5, 10, 15, 20];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Generate contextual hint based on word length
function buildHint(word: string, revealExtra: boolean): string {
  const len = word.length;
  const chars = word.split('');

  if (len <= 4) {
    // Short: show 1st letter
    return chars.map((c, i) => i === 0 ? c : '_').join(' ');
  }

  if (len <= 8) {
    // Medium: show 1st and last letter, plus middle if extra
    const indices = new Set([0, len - 1]);
    if (revealExtra) {
      indices.add(Math.floor(len / 2));
    }
    return chars.map((c, i) => indices.has(i) ? c : '_').join(' ');
  }

  // Long (9+): show 1st letter, key vowels, and last letter
  const vowels = new Set(['a', 'e', 'i', 'o', 'u']);
  const indices = new Set([0, len - 1]);
  // Add first vowel after position 1
  for (let i = 1; i < len - 1; i++) {
    if (vowels.has(chars[i].toLowerCase())) {
      indices.add(i);
      break;
    }
  }
  if (revealExtra) {
    // Reveal more vowels
    let count = 0;
    for (let i = 1; i < len - 1; i++) {
      if (vowels.has(chars[i].toLowerCase()) && !indices.has(i)) {
        indices.add(i);
        count++;
        if (count >= 2) break;
      }
    }
  }
  return chars.map((c, i) => indices.has(i) ? c : '_').join(' ');
}

export function TypingTest() {
  const { vocabs, incrementError } = useVocab();
  const { t } = useLanguage();
  const { show } = useToast();

  const [phase, setPhase] = useState<'setup' | 'playing' | 'done'>('setup');
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState<Vocabulary[]>([]);
  const [current, setCurrent] = useState(0);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<'correct' | 'incorrect' | null>(null);
  const [score, setScore] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [extraHint, setExtraHint] = useState(false);
  const [rate, setRate] = useState(getGlobalRate());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (phase === 'playing' && result === null && inputRef.current) {
      inputRef.current.focus();
    }
  }, [phase, result, current]);

  const start = () => {
    if (vocabs.length < 1) {
      show(t('notEnoughWordsTyping'), 'error');
      return;
    }
    const qs = shuffle(vocabs).slice(0, Math.min(count, vocabs.length));
    setQuestions(qs);
    setCurrent(0);
    setInput('');
    setResult(null);
    setScore(0);
    setShowHint(false);
    setExtraHint(false);
    setPhase('playing');
  };

  const handleCheck = () => {
    if (!input.trim() || result !== null) return;
    const correct = input.trim().toLowerCase() === questions[current].word.toLowerCase();
    let finalScore = score;
    if (correct) {
      finalScore = score + 1;
      // Penalty for using extra hints
      if (extraHint) finalScore = Math.max(0, finalScore - 0.5);
      setScore(finalScore);
    } else {
      incrementError(questions[current].word);
    }
    setResult(correct ? 'correct' : 'incorrect');
    addPracticeRecord({
      type: 'typing',
      vocabId: questions[current].id,
      word: questions[current].word,
      correct,
      timestamp: Date.now(),
    });
  };

  const nextQuestion = () => {
    if (current + 1 >= questions.length) {
      setPhase('done');
    } else {
      setCurrent((c) => c + 1);
      setInput('');
      setResult(null);
      setShowHint(false);
      setExtraHint(false);
    }
  };

  if (phase === 'setup') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-teal-100 flex items-center justify-center mb-4">
            <Keyboard className="w-8 h-8 text-teal-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{t('typingTitle')}</h2>
          <p className="text-slate-500 mt-1">{t('typingDesc')}</p>
          <div className="mt-8">
            <p className="text-sm font-semibold text-slate-600 mb-3">{t('questionCount')}</p>
            <div className="flex gap-2 justify-center flex-wrap">
              {QUESTION_COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`w-16 h-16 rounded-2xl font-bold text-lg transition-all ${
                    count === n
                      ? 'bg-gradient-to-br from-teal-500 to-sky-500 text-white shadow-md shadow-teal-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={start}
            disabled={vocabs.length < 1}
            className="mt-8 px-8 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-sky-500 text-white font-semibold hover:from-teal-600 hover:to-sky-600 transition-all shadow-md disabled:opacity-50"
          >
            {t('startQuiz')}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-teal-400 to-sky-400 flex items-center justify-center mb-4 shadow-md">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{t('typingComplete')}</h2>
          <div className="mt-6 flex items-center justify-center gap-8">
            <div>
              <p className="text-4xl font-bold text-teal-600">{Math.round(score)}</p>
              <p className="text-sm text-slate-500">{t('correct')}</p>
            </div>
            <div className="w-px h-12 bg-slate-200" />
            <div>
              <p className="text-4xl font-bold text-slate-400">{questions.length - Math.round(score)}</p>
              <p className="text-sm text-slate-500">{t('incorrect')}</p>
            </div>
            <div className="w-px h-12 bg-slate-200" />
            <div>
              <p className="text-4xl font-bold text-sky-600">{percentage}%</p>
              <p className="text-sm text-slate-500">{t('score')}</p>
            </div>
          </div>
          <button
            onClick={() => setPhase('setup')}
            className="mt-8 flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors mx-auto"
          >
            <RotateCcw className="w-5 h-5" />
            {t('retryQuiz')}
          </button>
        </div>
      </div>
    );
  }

  // Playing
  const q = questions[current];
  const progress = ((current + 1) / questions.length) * 100;
  const hintStr = buildHint(q.word, extraHint);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-600">
            {t('question')} {current + 1} {t('of')} {questions.length}
          </span>
          <span className="text-sm font-semibold text-teal-600">
            {t('score')}: {Math.round(score)}
          </span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-500 to-sky-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <p className="text-sm text-slate-400">{t('meaningLabel')}</p>
            <button
              onClick={() => speak(q.word, rate)}
              className="w-8 h-8 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-500 flex items-center justify-center transition-colors"
              title={t('playAudio')}
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
          <h2 className="text-3xl font-bold text-slate-800">{q.meaning}</h2>
          <div className="flex items-center justify-center gap-3 mt-2">
            {q.type && (
              <span className="inline-block text-sm font-semibold text-teal-600 bg-teal-50 px-3 py-1 rounded-full">
                {q.type}
              </span>
            )}
            {/* Speed control */}
            <select
              value={rate}
              onChange={(e) => {
                const newRate = parseFloat(e.target.value);
                setRate(newRate);
                setGlobalRate(newRate);
              }}
              className="text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-400 cursor-pointer"
            >
              {speedOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.key as TranslationKey)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Hint */}
        <div className="flex flex-col items-center gap-2 mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHint(!showHint)}
              className="flex items-center gap-1.5 text-sm font-semibold text-amber-600 hover:text-amber-700 transition-colors"
            >
              <Lightbulb className="w-4 h-4" />
              {t('hint')}
            </button>
            {showHint && !extraHint && result === null && (
              <button
                onClick={() => setExtraHint(true)}
                className="flex items-center gap-1 text-xs font-semibold text-amber-500 hover:text-amber-600 bg-amber-50 px-2 py-1 rounded-full transition-colors"
              >
                {t('showMoreHints')}
                <span className="text-rose-400">{t('hintPenalty')}</span>
              </button>
            )}
          </div>
          {showHint && (
            <div className="text-center">
              <p className="text-sm text-slate-500 mb-1">{q.word.length} {t('letters')}</p>
              <p className="text-lg font-mono font-bold text-slate-700 tracking-wider">{hintStr}</p>
            </div>
          )}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (result !== null) nextQuestion();
              else handleCheck();
            }
          }}
          disabled={result !== null}
          className={`w-full text-center text-2xl font-bold px-4 py-4 rounded-xl border-2 transition-all focus:outline-none ${
            result === 'correct'
              ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
              : result === 'incorrect'
              ? 'border-rose-400 bg-rose-50 text-rose-700'
              : 'border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-teal-400 focus:border-transparent'
          }`}
          placeholder={t('typeHere')}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {result === 'incorrect' && (
          <div className="mt-2 text-center flex items-center justify-center gap-2">
            <p className="text-sm text-rose-500 font-semibold">{q.word}</p>
            <button
              onClick={() => speak(q.word, rate)}
              className="w-7 h-7 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-500 flex items-center justify-center transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {result === null ? (
          <button
            onClick={handleCheck}
            disabled={!input.trim()}
            className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-sky-500 text-white font-semibold hover:from-teal-600 hover:to-sky-600 transition-all shadow-sm disabled:opacity-50"
          >
            <CheckCircle2 className="w-5 h-5" />
            {t('checkAnswer')}
          </button>
        ) : (
          <button
            onClick={nextQuestion}
            className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-sky-500 text-white font-semibold hover:from-teal-600 hover:to-sky-600 transition-all shadow-sm animate-fade-in"
          >
            {current + 1 >= questions.length ? t('finishQuiz') : t('nextQuestion')}
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {result !== null && (
          <div className="mt-4 flex items-center justify-center gap-2">
            {result === 'correct' ? (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                <CheckCircle2 className="w-5 h-5" /> {t('correct')}!
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-rose-600">
                <XCircle className="w-5 h-5" /> {t('incorrect')}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

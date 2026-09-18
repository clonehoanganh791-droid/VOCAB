import { useState, useMemo, useEffect } from 'react';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw, Volume2, Trophy, ListChecks } from 'lucide-react';
import { useVocab } from '@/context/VocabContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/components/Toast';
import { speak, speedOptions, getGlobalRate, setGlobalRate } from '@/lib/speech';
import { addPracticeRecord } from '@/lib/storage';
import type { Vocabulary, QuizQuestion } from '@/lib/types';
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

function buildQuestions(vocabs: Vocabulary[], count: number): QuizQuestion[] {
  const selected = shuffle(vocabs).slice(0, count);
  return selected.map((vocab) => {
    const others = vocabs.filter((v) => v.id !== vocab.id);
    const distractors = shuffle(others).slice(0, 3).map((v) => v.word);
    const options = shuffle([vocab.word, ...distractors]);
    const correctIndex = options.indexOf(vocab.word);
    return { vocab, options, correctIndex };
  });
}

export function Quiz() {
  const { vocabs, incrementError } = useVocab();
  const { t } = useLanguage();
  const { show } = useToast();

  const [phase, setPhase] = useState<'setup' | 'playing' | 'done'>('setup');
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [current, setCurrent] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [rate, setRate] = useState(getGlobalRate());

  const startQuiz = () => {
    if (vocabs.length < 4) {
      show(t('notEnoughWords'), 'error');
      return;
    }
    const qs = buildQuestions(vocabs, Math.min(count, vocabs.length));
    setQuestions(qs);
    setCurrent(0);
    setSelectedAnswer(null);
    setScore(0);
    setPhase('playing');
  };

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(index);
    const correct = index === questions[current].correctIndex;
    if (correct) {
      setScore((s) => s + 1);
    } else {
      incrementError(questions[current].vocab.word);
    }
    addPracticeRecord({
      type: 'quiz',
      vocabId: questions[current].vocab.id,
      word: questions[current].vocab.word,
      correct,
      timestamp: Date.now(),
    });
  };

  const nextQuestion = () => {
    if (current + 1 >= questions.length) {
      setPhase('done');
    } else {
      setCurrent((c) => c + 1);
      setSelectedAnswer(null);
    }
  };

  const retry = () => {
    setPhase('setup');
  };

  if (phase === 'setup') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-sky-100 flex items-center justify-center mb-4">
            <ListChecks className="w-8 h-8 text-sky-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{t('quizTitle')}</h2>
          <p className="text-slate-500 mt-1">{t('quizDesc')}</p>
          <div className="mt-8">
            <p className="text-sm font-semibold text-slate-600 mb-3">{t('questionCount')}</p>
            <div className="flex gap-2 justify-center flex-wrap">
              {QUESTION_COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`w-16 h-16 rounded-2xl font-bold text-lg transition-all ${
                    count === n
                      ? 'bg-gradient-to-br from-sky-500 to-teal-500 text-white shadow-md shadow-sky-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={startQuiz}
            disabled={vocabs.length < 4}
            className="mt-8 px-8 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 text-white font-semibold hover:from-sky-600 hover:to-teal-600 transition-all shadow-md disabled:opacity-50"
          >
            {t('startQuiz')}
          </button>
          {vocabs.length < 4 && (
            <p className="mt-3 text-sm text-rose-500">{t('notEnoughWords')}</p>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center mb-4 shadow-md">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{t('quizComplete')}</h2>
          <div className="mt-6 flex items-center justify-center gap-8">
            <div>
              <p className="text-4xl font-bold text-sky-600">{score}</p>
              <p className="text-sm text-slate-500">{t('correct')}</p>
            </div>
            <div className="w-px h-12 bg-slate-200" />
            <div>
              <p className="text-4xl font-bold text-slate-400">{questions.length - score}</p>
              <p className="text-sm text-slate-500">{t('incorrect')}</p>
            </div>
            <div className="w-px h-12 bg-slate-200" />
            <div>
              <p className="text-4xl font-bold text-teal-600">{percentage}%</p>
              <p className="text-sm text-slate-500">{t('score')}</p>
            </div>
          </div>
          <div className="mt-8 flex gap-3 justify-center">
            <button
              onClick={retry}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
              {t('retryQuiz')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Playing
  const q = questions[current];
  const progress = ((current + 1) / questions.length) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-600">
            {t('question')} {current + 1} {t('of')} {questions.length}
          </span>
          <span className="text-sm font-semibold text-sky-600">
            {t('score')}: {score}
          </span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-teal-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        <div className="text-center mb-6">
          <p className="text-sm text-slate-400 mb-2">{t('meaningLabel')}</p>
          <h2 className="text-3xl font-bold text-slate-800">{q.vocab.meaning}</h2>
          {q.vocab.type && (
            <span className="inline-block mt-2 text-sm font-semibold text-sky-600 bg-sky-50 px-3 py-1 rounded-full">
              {q.vocab.type}
            </span>
          )}
        </div>

        {/* Audio + speed */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <button
            onClick={() => speak(q.vocab.word, rate)}
            className="w-10 h-10 rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors"
            title={t('playAudio')}
          >
            <Volume2 className="w-5 h-5" />
          </button>
          <select
            value={rate}
            onChange={(e) => {
              const newRate = parseFloat(e.target.value);
              setRate(newRate);
              setGlobalRate(newRate);
            }}
            className="text-sm font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer"
          >
            {speedOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.key as TranslationKey)}
              </option>
            ))}
          </select>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {q.options.map((option, i) => {
            const isCorrect = i === q.correctIndex;
            const isSelected = i === selectedAnswer;
            let style = 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50 text-slate-700';
            if (selectedAnswer !== null) {
              if (isCorrect) {
                style = 'border-emerald-400 bg-emerald-50 text-emerald-700';
              } else if (isSelected) {
                style = 'border-rose-400 bg-rose-50 text-rose-700';
              } else {
                style = 'border-slate-200 bg-white text-slate-400';
              }
            }
            return (
              <div
                key={i}
                className={`flex items-center justify-between px-5 py-4 rounded-xl border-2 font-semibold transition-all ${style}`}
              >
                <button
                  onClick={() => handleAnswer(i)}
                  disabled={selectedAnswer !== null}
                  className="flex-1 text-left"
                >
                  {option}
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      speak(option, rate);
                    }}
                    className="w-7 h-7 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-500 flex items-center justify-center transition-colors flex-shrink-0"
                    title={t('playAudio')}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                  {selectedAnswer !== null && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  {selectedAnswer !== null && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-rose-500" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Next button */}
        {selectedAnswer !== null && (
          <button
            onClick={nextQuestion}
            className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 text-white font-semibold hover:from-sky-600 hover:to-teal-600 transition-all shadow-sm animate-fade-in"
          >
            {current + 1 >= questions.length ? t('finishQuiz') : t('nextQuestion')}
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

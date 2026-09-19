import { useState } from 'react';
import { PenLine, ChevronRight, RotateCcw, Trophy, Sparkles, CheckCircle2, XCircle, Lightbulb, BookOpen, Volume2, Loader2 } from 'lucide-react';
import { useVocab } from '@/context/VocabContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/components/Toast';
import { evaluateSentence, type GrammarEvaluation } from '@/lib/grammarCheck';
import { evaluateWithGemini } from '@/lib/gemini';
import { speak, speedOptions, getGlobalRate, setGlobalRate } from '@/lib/speech';
import { addPracticeRecord } from '@/lib/storage';
import type { Vocabulary } from '@/lib/types';
import type { TranslationKey } from '@/lib/i18n';

const WORD_COUNTS = [5, 10, 15, 20];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function SentenceBuilding() {
  const { vocabs } = useVocab();
  const { t, lang } = useLanguage();
  const { show } = useToast();

  const [phase, setPhase] = useState<'setup' | 'playing' | 'done'>('setup');
  const [count, setCount] = useState(10);
  const [questions, setQuestions] = useState<Vocabulary[]>([]);
  const [current, setCurrent] = useState(0);
  const [sentence, setSentence] = useState('');
  const [evaluation, setEvaluation] = useState<GrammarEvaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [totalAccuracy, setTotalAccuracy] = useState(0);
  const [rate, setRate] = useState(getGlobalRate());

  const start = () => {
    if (vocabs.length < 1) {
      show(t('notEnoughWordsSentence'), 'error');
      return;
    }
    const qs = shuffle(vocabs).slice(0, Math.min(count, vocabs.length));
    setQuestions(qs);
    setCurrent(0);
    setSentence('');
    setEvaluation(null);
    setTotalAccuracy(0);
    setPhase('playing');
  };

  const handleEvaluate = async () => {
    if (!sentence.trim() || evaluation || evaluating) return;
    setEvaluating(true);

    const vocab = questions[current];

    try {
      const result = await evaluateWithGemini({
        sentence: sentence.trim(),
        targetWord: vocab.word,
        wordType: vocab.type,
        meaning: vocab.meaning,
        lang,
      });
      setEvaluation(result);
      setTotalAccuracy((a) => a + result.accuracy);
      addPracticeRecord({
        type: 'sentence',
        vocabId: vocab.id,
        word: vocab.word,
        correct: result.accuracy >= 75,
        accuracy: result.accuracy,
        timestamp: Date.now(),
      });
    } catch {
      // Fallback to local evaluation
      const result = evaluateSentence({
        sentence: sentence.trim(),
        targetWord: vocab.word,
        wordType: vocab.type,
        meaning: vocab.meaning,
        lang,
      });
      setEvaluation(result);
      setTotalAccuracy((a) => a + result.accuracy);
      addPracticeRecord({
        type: 'sentence',
        vocabId: vocab.id,
        word: vocab.word,
        correct: result.accuracy >= 75,
        accuracy: result.accuracy,
        timestamp: Date.now(),
      });
    }
    setEvaluating(false);
  };

  const nextWord = () => {
    if (current + 1 >= questions.length) {
      setPhase('done');
    } else {
      setCurrent((c) => c + 1);
      setSentence('');
      setEvaluation(null);
    }
  };

  if (phase === 'setup') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-indigo-100 flex items-center justify-center mb-4">
            <PenLine className="w-8 h-8 text-indigo-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{t('sentenceTitle')}</h2>
          <p className="text-slate-500 mt-1">{t('sentenceDesc')}</p>
          <div className="mt-8">
            <p className="text-sm font-semibold text-slate-600 mb-3">{t('wordCount')}</p>
            <div className="flex gap-2 justify-center flex-wrap">
              {WORD_COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`w-16 h-16 rounded-2xl font-bold text-lg transition-all ${
                    count === n
                      ? 'bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-md shadow-indigo-500/20'
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
            className="mt-8 px-8 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 text-white font-semibold hover:from-indigo-600 hover:to-sky-600 transition-all shadow-md disabled:opacity-50"
          >
            {t('startSentence')}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    const avgAccuracy = Math.round(totalAccuracy / questions.length);
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-indigo-400 to-sky-400 flex items-center justify-center mb-4 shadow-md">
            <Trophy className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">{t('sentenceComplete')}</h2>
          <div className="mt-6">
            <p className="text-5xl font-bold text-indigo-600">{avgAccuracy}%</p>
            <p className="text-sm text-slate-500 mt-1">{t('avgAccuracy')}</p>
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

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-600">
            {t('question')} {current + 1} {t('of')} {questions.length}
          </span>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-sky-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
        {/* Target word with audio */}
        <div className="text-center mb-6 p-6 rounded-xl bg-gradient-to-br from-indigo-50 to-sky-50 border border-indigo-100">
          <p className="text-sm text-slate-400 mb-1">{t('targetWord')}</p>
          <div className="flex items-center justify-center gap-3">
            <h2 className="text-3xl font-bold text-slate-800">{q.word}</h2>
            <button
              onClick={() => speak(q.word, rate)}
              className="w-9 h-9 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-500 flex items-center justify-center transition-colors"
              title={t('playAudio')}
            >
              <Volume2 className="w-5 h-5" />
            </button>
          </div>
          {q.type && (
            <span className="inline-block mt-2 text-sm font-semibold text-indigo-600 bg-white px-3 py-1 rounded-full">
              {q.type}
            </span>
          )}
          <p className="mt-2 text-lg text-slate-600">{q.meaning}</p>
          {/* Speed control */}
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <select
              value={rate}
              onChange={(e) => {
                const newRate = parseFloat(e.target.value);
                setRate(newRate);
                setGlobalRate(newRate);
              }}
              className="text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
            >
              {speedOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.key as TranslationKey)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Textarea */}
        <textarea
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          disabled={evaluation !== null || evaluating}
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all resize-y"
          placeholder={t('writeSentence')}
        />

        {/* Evaluate button */}
        {evaluation === null && !evaluating ? (
          <button
            onClick={handleEvaluate}
            disabled={!sentence.trim()}
            className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 text-white font-semibold hover:from-indigo-600 hover:to-sky-600 transition-all shadow-sm disabled:opacity-50"
          >
            <Sparkles className="w-5 h-5" />
            {t('evaluate')}
          </button>
        ) : evaluating ? (
          <div className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 font-semibold">
            <Loader2 className="w-5 h-5 animate-spin" />
            {t('aiEvaluating')}
          </div>
        ) : evaluation ? (
          <>
            {/* Structured evaluation result */}
            <div className="mt-4 space-y-4 animate-fade-in">
              {/* Accuracy bar + badges */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-slate-600">{t('accuracy')}</span>
                    <span className={`text-sm font-bold ${evaluation.accuracy >= 75 ? 'text-emerald-600' : evaluation.accuracy >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                      {evaluation.accuracy}%
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        evaluation.accuracy >= 75 ? 'bg-emerald-500' : evaluation.accuracy >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${evaluation.accuracy}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Grammar & Naturalness badges */}
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                  evaluation.isGrammarCorrect
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-100 text-rose-700 border border-rose-200'
                }`}>
                  {evaluation.isGrammarCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {evaluation.isGrammarCorrect ? t('grammarCorrect') : t('grammarIncorrect')}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                  evaluation.isNatural
                    ? 'bg-sky-100 text-sky-700 border border-sky-200'
                    : 'bg-amber-100 text-amber-700 border border-amber-200'
                }`}>
                  <Sparkles className="w-4 h-4" />
                  {t('naturalnessBadge')}: {evaluation.isNatural ? t('natural') : t('unnatural')}
                </span>
              </div>

              {/* Errors Found */}
              {evaluation.errors.length > 0 ? (
                <div className="rounded-xl p-4 border border-rose-200 bg-rose-50">
                  <div className="flex items-start gap-2 mb-2">
                    <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-bold text-rose-700">{t('errorsFound')}</p>
                  </div>
                  <div className="space-y-2 ml-7">
                    {evaluation.errors.map((err, idx) => (
                      <div key={idx} className="text-sm">
                        <p className="font-semibold text-rose-600">{err.message}</p>
                        {err.explanation && <p className="text-rose-500 text-xs mt-0.5">{err.explanation}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl p-4 border border-emerald-200 bg-emerald-50">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <p className="text-sm font-bold text-emerald-700">{t('noErrorsFound')}</p>
                  </div>
                </div>
              )}

              {/* Detailed Feedback */}
              {evaluation.feedback && (
                <div className="rounded-xl p-4 border border-amber-200 bg-amber-50">
                  <div className="flex items-start gap-2 mb-2">
                    <Lightbulb className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-bold text-amber-700">{t('detailedFeedback')}</p>
                  </div>
                  <div className="text-sm text-slate-600 whitespace-pre-line ml-7 leading-relaxed">
                    {evaluation.feedback.split('\n').map((line, i) => {
                      const trimmed = line.trim();
                      if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
                        return <p key={i} className="ml-3 my-0.5">{trimmed}</p>;
                      }
                      if (trimmed.match(/^(Ngữ pháp|Collocation|Tone|Grammar|Collocation &|Tone &|Phong cách)/i)) {
                        return <p key={i} className="font-semibold text-amber-800 mt-2 mb-0.5">{trimmed}</p>;
                      }
                      return <p key={i} className="my-0.5">{trimmed}</p>;
                    })}
                  </div>
                </div>
              )}

              {/* Advanced Native Examples */}
              {evaluation.improvedSentences.length > 0 && (
                <div className="rounded-xl p-4 border border-sky-200 bg-sky-50">
                  <div className="flex items-start gap-2 mb-1">
                    <Sparkles className="w-5 h-5 text-sky-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-sky-700">{t('advancedExamples')}</p>
                      <p className="text-xs text-sky-500 mt-0.5">{t('advancedExamplesDesc')}</p>
                    </div>
                  </div>
                  <div className="ml-7 mt-3 space-y-3">
                    {evaluation.improvedSentences.map((s, idx) => (
                      <div key={idx} className="rounded-lg bg-white border border-sky-100 p-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {idx + 1}
                          </span>
                          <p className="text-sm text-sky-700 font-medium flex-1">{s.en}</p>
                          <button
                            onClick={() => speak(s.en, rate)}
                            className="w-7 h-7 rounded-full bg-sky-100 hover:bg-sky-200 text-sky-500 flex items-center justify-center transition-colors flex-shrink-0"
                            title={t('playAudio')}
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {s.vi && (
                          <p className="text-sm text-slate-500 italic mt-1.5 ml-8">{s.vi}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grammar Structure */}
              {evaluation.grammarStructure && (
                <div className="rounded-xl p-4 border border-indigo-200 bg-indigo-50">
                  <div className="flex items-start gap-2 mb-2">
                    <BookOpen className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-bold text-indigo-700">{t('grammarStructure')}</p>
                  </div>
                  <p className="text-sm text-slate-600 ml-7 whitespace-pre-line">{evaluation.grammarStructure}</p>
                </div>
              )}
            </div>

            <button
              onClick={nextWord}
              className="mt-4 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-sky-500 text-white font-semibold hover:from-indigo-600 hover:to-sky-600 transition-all shadow-sm"
            >
              {current + 1 >= questions.length ? t('finishQuiz') : t('nextWord')}
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

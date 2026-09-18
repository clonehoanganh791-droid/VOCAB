import { useMemo } from 'react';
import { TrendingDown, Target, Award, BookOpen, ChevronRight, BarChart3, AlertTriangle, Volume2 } from 'lucide-react';
import { useVocab } from '@/context/VocabContext';
import { useLanguage } from '@/context/LanguageContext';
import { speak } from '@/lib/speech';
import { getPracticeHistory, type PracticeRecord } from '@/lib/storage';
import type { TabKey } from '@/lib/types';

interface AnalyticsProps {
  onNavigate: (tab: TabKey) => void;
  weakWordIds?: Set<string>;
}

export function Analytics({ onNavigate }: AnalyticsProps) {
  const { vocabs } = useVocab();
  const { t } = useLanguage();

  const history = useMemo(() => getPracticeHistory(), []);

  const weakWords = useMemo(() => {
    return [...vocabs]
      .filter((v) => v.error_count > 0)
      .sort((a, b) => b.error_count - a.error_count)
      .slice(0, 10);
  }, [vocabs]);

  const stats = useMemo(() => {
    const quizRecords = history.filter((r) => r.type === 'quiz');
    const typingRecords = history.filter((r) => r.type === 'typing');
    const sentenceRecords = history.filter((r) => r.type === 'sentence');

    const calcAccuracy = (records: PracticeRecord[]) => {
      if (records.length === 0) return 0;
      const correct = records.filter((r) => r.correct).length;
      return Math.round((correct / records.length) * 100);
    };

    const sentenceAvg = sentenceRecords.length > 0
      ? Math.round(sentenceRecords.reduce((sum, r) => sum + (r.accuracy || 0), 0) / sentenceRecords.length)
      : 0;

    return {
      quizAccuracy: calcAccuracy(quizRecords),
      typingAccuracy: calcAccuracy(typingRecords),
      sentenceAccuracy: sentenceAvg,
      quizTotal: quizRecords.length,
      typingTotal: typingRecords.length,
      sentenceTotal: sentenceRecords.length,
      quizCorrect: quizRecords.filter((r) => r.correct).length,
      typingCorrect: typingRecords.filter((r) => r.correct).length,
    };
  }, [history]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    vocabs.forEach((v) => {
      const cat = v.category || 'General';
      map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [vocabs]);

  const maxCatCount = Math.max(...categories.map((c) => c[1]), 1);

  const hasData = history.length > 0;

  if (vocabs.length === 0 && !hasData) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <div className="w-20 h-20 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <BarChart3 className="w-10 h-10 text-slate-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-700">{t('noDataYet')}</h3>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<BookOpen className="w-5 h-5" />} label={t('totalWords')} value={vocabs.length} color="sky" />
        <StatCard icon={<Target className="w-5 h-5" />} label={t('quizAccuracy')} value={`${stats.quizAccuracy}%`} color="emerald" />
        <StatCard icon={<Award className="w-5 h-5" />} label={t('typingAccuracy')} value={`${stats.typingAccuracy}%`} color="teal" />
        <StatCard icon={<TrendingDown className="w-5 h-5" />} label={t('sentenceAccuracy')} value={`${stats.sentenceAccuracy}%`} color="indigo" />
      </div>

      {/* Accuracy breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4">{t('recentActivity')}</h3>
        {!hasData ? (
          <p className="text-sm text-slate-400 text-center py-8">{t('noDataYet')}</p>
        ) : (
          <div className="space-y-4">
            <AccuracyBar label={t('quizAccuracy')} value={stats.quizAccuracy} total={stats.quizTotal} correct={stats.quizCorrect} color="emerald" />
            <AccuracyBar label={t('typingAccuracy')} value={stats.typingAccuracy} total={stats.typingTotal} correct={stats.typingCorrect} color="teal" />
            <AccuracyBar label={t('sentenceAccuracy')} value={stats.sentenceAccuracy} total={stats.sentenceTotal} correct={Math.round(stats.sentenceTotal * stats.sentenceAccuracy / 100)} color="indigo" />
          </div>
        )}
      </div>

      {/* Words by category */}
      {categories.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4">{t('wordsByCategory')}</h3>
          <div className="space-y-3">
            {categories.map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-600 w-32 truncate">{cat}</span>
                <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-sky-400 to-teal-400 rounded-lg transition-all duration-500 flex items-center justify-end px-2"
                    style={{ width: `${(count / maxCatCount) * 100}%` }}
                  >
                    <span className="text-xs font-bold text-white">{count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weak words */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <h3 className="font-bold text-slate-800">{t('weakWords')}</h3>
          </div>
          {weakWords.length > 0 && (
            <button
              onClick={() => onNavigate('quiz')}
              className="flex items-center gap-1.5 text-sm font-semibold text-sky-600 hover:text-sky-700 transition-colors"
            >
              {t('practiceWeakNow')}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
        {weakWords.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">{t('noWeakWords')}</p>
        ) : (
          <div className="space-y-2">
            {weakWords.map((word, i) => (
              <div
                key={word.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  i < 3 ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-500'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{word.word}</span>
                    {word.type && <span className="text-xs text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">{word.type}</span>}
                  </div>
                  <p className="text-sm text-slate-500">{word.meaning}</p>
                </div>
                <button
                  onClick={() => speak(word.word)}
                  className="w-8 h-8 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-500 flex items-center justify-center transition-colors flex-shrink-0"
                  title={t('playAudio')}
                >
                  <Volume2 className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50">
                  <span className="text-sm font-bold text-rose-600">{word.error_count}</span>
                  <span className="text-xs text-rose-400">{t('errorCount').toLowerCase()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    sky: 'bg-sky-50 text-sky-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    teal: 'bg-teal-50 text-teal-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function AccuracyBar({ label, value, total, correct, color }: { label: string; value: number; total: number; correct: number; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500',
    teal: 'bg-teal-500',
    indigo: 'bg-indigo-500',
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-slate-600">{label}</span>
        <span className="text-sm text-slate-500">
          {correct}/{total} ({value}%)
        </span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colors[color]}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

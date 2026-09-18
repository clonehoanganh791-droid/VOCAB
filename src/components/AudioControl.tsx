import { useState, useEffect } from 'react';
import { Volume2, Gauge } from 'lucide-react';
import { speak, speedOptions, getGlobalRate, setGlobalRate } from '@/lib/speech';
import { useLanguage } from '@/context/LanguageContext';
import type { TranslationKey } from '@/lib/i18n';

interface AudioControlProps {
  text: string;
  size?: 'sm' | 'md' | 'lg';
  showSpeed?: boolean;
  variant?: 'default' | 'ghost';
}

export function AudioControl({ text, size = 'md', showSpeed = true, variant = 'default' }: AudioControlProps) {
  const { t } = useLanguage();
  const [rate, setRateState] = useState(getGlobalRate());

  useEffect(() => {
    setGlobalRate(rate);
  }, [rate]);

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const buttonClass = variant === 'ghost'
    ? `${sizeClasses[size]} rounded-full bg-transparent hover:bg-slate-100 text-slate-500 hover:text-sky-600 flex items-center justify-center transition-colors`
    : `${sizeClasses[size]} rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-colors shadow-sm hover:shadow-md`;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => speak(text, rate)}
        className={buttonClass}
        title={t('playAudio')}
      >
        <Volume2 className={iconSizes[size]} />
      </button>
      {showSpeed && (
        <div className="relative flex items-center gap-1.5">
          <Gauge className="w-4 h-4 text-slate-400" />
          <select
            value={rate}
        onChange={(e) => {
          const newRate = parseFloat(e.target.value);
          setRateState(newRate);
          setGlobalRate(newRate);
          speak(text, newRate);
        }}
        className="text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer"
      >
        {speedOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {t(opt.key as TranslationKey)}
          </option>
        ))}
      </select>
        </div>
      )}
    </div>
  );
}

// Compact inline audio button — just the speaker icon, no speed control
export function AudioButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'md' }) {
  const { t } = useLanguage();
  const sizeClasses = { sm: 'w-7 h-7', md: 'w-9 h-9' };
  const iconSizes = { sm: 'w-3.5 h-3.5', md: 'w-4.5 h-4.5' };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
      className={`${sizeClasses[size]} rounded-full bg-sky-50 hover:bg-sky-100 text-sky-500 flex items-center justify-center transition-colors flex-shrink-0`}
      title={t('playAudio')}
    >
      <Volume2 className={iconSizes[size]} />
    </button>
  );
}

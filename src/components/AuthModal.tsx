import { useState, useEffect } from 'react';
import { X, Mail, Lock, BookOpen, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import type { TranslationKey } from '@/lib/i18n';

type AuthMode = 'login' | 'signup' | 'reset';

interface AuthModalProps {
  open: boolean;
  initialMode: AuthMode;
  onClose: () => void;
}

export function AuthModal({ open, initialMode, onClose }: AuthModalProps) {
  const { signIn, signUp, resetPassword } = useAuth();
  const { t } = useLanguage();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError(null);
      setSuccessMsg(null);
      setEmail('');
      setPassword('');
    }
  }, [open, initialMode]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setError(t('errEmailRequired'));
      return;
    }
    if (mode !== 'reset' && !password) {
      setError(t('errPasswordRequired'));
      return;
    }
    if (mode === 'signup' && password.length < 6) {
      setError(t('errPasswordsTooShort'));
      return;
    }

    setLoading(true);
    if (mode === 'login') {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        setError(t('errInvalidCredentials'));
      } else {
        onClose();
      }
    } else if (mode === 'signup') {
      const { error } = await signUp(email.trim(), password);
      if (error) {
        if (error.toLowerCase().includes('already') || error.toLowerCase().includes('registered')) {
          setError(t('errEmailInUse'));
        } else if (error.toLowerCase().includes('password') || error.toLowerCase().includes('weak')) {
          setError(t('errWeakPassword'));
        } else {
          setError(error);
        }
      } else {
        setSuccessMsg(t('checkEmailConfirm'));
      }
    } else {
      const { error } = await resetPassword(email.trim());
      if (error) {
        setError(error);
      } else {
        setSuccessMsg(t('errResetSent'));
      }
    }
    setLoading(false);
  };

  const titles: Record<AuthMode, TranslationKey> = {
    login: 'welcomeBack',
    signup: 'joinNow',
    reset: 'resetPassword',
  };
  const subtitles: Record<AuthMode, TranslationKey> = {
    login: 'authSubtitle',
    signup: 'signUpSubtitle',
    reset: 'resetSubtitle',
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-sky-500 to-teal-500 px-8 pt-8 pb-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-white mb-2">
            <BookOpen className="w-7 h-7" />
            <span className="text-xl font-bold">{t('appName')}</span>
          </div>
          <h2 className="text-2xl font-bold text-white">{t(titles[mode])}</h2>
          <p className="text-sm text-white/80 mt-1">{t(subtitles[mode])}</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-700">
              {successMsg}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('email')}</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </div>

          {mode !== 'reset' && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('password')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-teal-500 text-white font-semibold hover:from-sky-600 hover:to-teal-600 transition-all shadow-md shadow-sky-500/20 disabled:opacity-60"
          >
            {loading ? t('loading') : mode === 'login' ? t('login') : mode === 'signup' ? t('createAccount') : t('sendResetLink')}
          </button>

          {/* Links */}
          <div className="text-center space-y-2 pt-2">
            {mode === 'login' && (
              <>
                <button
                  type="button"
                  onClick={() => { setMode('reset'); setError(null); setSuccessMsg(null); }}
                  className="text-sm text-sky-600 hover:text-sky-700 font-medium"
                >
                  {t('forgotPassword')}
                </button>
                <p className="text-sm text-slate-500">
                  {t('noAccount')}{' '}
                  <button type="button" onClick={() => { setMode('signup'); setError(null); setSuccessMsg(null); }} className="text-sky-600 hover:text-sky-700 font-semibold">
                    {t('signUp')}
                  </button>
                </p>
              </>
            )}
            {mode === 'signup' && (
              <p className="text-sm text-slate-500">
                {t('haveAccount')}{' '}
                <button type="button" onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }} className="text-sky-600 hover:text-sky-700 font-semibold">
                  {t('login')}
                </button>
              </p>
            )}
            {mode === 'reset' && (
              <p className="text-sm text-slate-500">
                <button type="button" onClick={() => { setMode('login'); setError(null); setSuccessMsg(null); }} className="text-sky-600 hover:text-sky-700 font-semibold">
                  {t('backToLogin')}
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

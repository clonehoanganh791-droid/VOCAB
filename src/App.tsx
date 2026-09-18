import { useState } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { VocabProvider } from '@/context/VocabContext';
import { ToastProvider } from '@/components/Toast';
import { Header } from '@/components/Header';
import { AddVocabulary } from '@/pages/AddVocabulary';
import { VocabChest } from '@/pages/VocabChest';
import { Quiz } from '@/pages/Quiz';
import { TypingTest } from '@/pages/TypingTest';
import { SentenceBuilding } from '@/pages/SentenceBuilding';
import { Analytics } from '@/pages/Analytics';
import { useLanguage } from '@/context/LanguageContext';
import type { TabKey } from '@/lib/types';

function AppContent() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<TabKey>('add');

  return (
    <div className="min-h-screen bg-slate-50">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'add' && <AddVocabulary />}
        {activeTab === 'chest' && <VocabChest />}
        {activeTab === 'quiz' && <Quiz />}
        {activeTab === 'typing' && <TypingTest />}
        {activeTab === 'sentence' && <SentenceBuilding />}
        {activeTab === 'analytics' && <Analytics onNavigate={setActiveTab} />}
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-sm text-slate-400">
        {t('appName')} — {t('tagline')}
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ToastProvider>
        <AuthProvider>
          <VocabProvider>
            <AppContent />
          </VocabProvider>
        </AuthProvider>
      </ToastProvider>
    </LanguageProvider>
  );
}

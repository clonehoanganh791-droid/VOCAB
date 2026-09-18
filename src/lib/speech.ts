let voices: SpeechSynthesisVoice[] = [];
let voicesLoaded = false;
let globalRate: number = 1.0;

function loadVoices() {
  voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    voicesLoaded = true;
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    loadVoices();
  };
}

export function getEnglishVoice(): SpeechSynthesisVoice | null {
  if (!voicesLoaded) {
    loadVoices();
  }
  const enVoice = voices.find((v) => v.lang.startsWith('en'));
  return enVoice || voices[0] || null;
}

export function speak(text: string, rate?: number) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();

  // iOS Safari unlock
  window.speechSynthesis.resume();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = rate ?? globalRate;
  utterance.pitch = 1.0;

  const voice = getEnglishVoice();
  if (voice) {
    utterance.voice = voice;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function getGlobalRate(): number {
  return globalRate;
}

export function setGlobalRate(rate: number) {
  globalRate = rate;
}

export const speedOptions = [
  { value: 0.5, key: 'speedSlow' as const },
  { value: 0.75, key: 'speedMedium' as const },
  { value: 1.0, key: 'speedNormal' as const },
  { value: 1.25, key: 'speedFast' as const },
];

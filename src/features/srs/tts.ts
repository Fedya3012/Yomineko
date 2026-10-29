// Reads Japanese aloud with the device's own speech engine (no download, works offline when the device has a Japanese voice).
export const canSpeak = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';

export function speak(text: string, rate = 0.85): boolean {
  if (!canSpeak()) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = rate;
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('ja'));
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
  return true;
}

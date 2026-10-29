// Phát âm bằng giọng đọc sẵn có của máy (Web Speech API). Không cần tải âm thanh, không dính bản quyền.
export function canSpeak(): boolean {
  return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
}

export function hasJapaneseVoice(): boolean {
  return canSpeak() && speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith('ja'));
}

/** Đọc một đoạn tiếng Nhật; trả về false nếu máy không hỗ trợ. */
export function speak(text: string, rate = 0.8): boolean {
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

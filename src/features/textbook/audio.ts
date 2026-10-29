// Plays a learner-supplied audio file if one is attached, otherwise the device's Japanese voice.
import type { DB } from '../../lib/db';
import { loadAudio } from './store';

let current: HTMLAudioElement | undefined;

export const canSpeak = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';

export function speak(text: string, rate = 0.9) {
  if (!canSpeak()) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = rate;
  speechSynthesis.speak(u);
  return true;
}

/** Returns "file" | "voice" | "none" so the screen can tell the learner what happened. */
export async function playAudio(db: DB, lessonId: string, key: string, text: string): Promise<'file' | 'voice' | 'none'> {
  const blob = await loadAudio(db, lessonId, key);
  if (blob) {
    current?.pause();
    const url = URL.createObjectURL(blob);
    current = new Audio(url);
    current.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
    await current.play();
    return 'file';
  }
  return speak(text) ? 'voice' : 'none';
}

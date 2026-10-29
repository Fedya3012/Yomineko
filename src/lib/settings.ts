// User display settings. Persisted in localStorage (tiny, synchronous, safe to read before first paint).
export type ThemeChoice = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemeChoice;
  furigana: boolean;
  /** 1 = normal, up to 2 = 200% (WCAG 1.4.4 asks for text that scales to 200% without breaking). */
  fontScale: number;
  highContrast: boolean;
  vertical: boolean;
  reduceMotion: boolean;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', furigana: true, fontScale: 1, highContrast: false, vertical: false, reduceMotion: false };
const KEY = 'yomineko.settings.v1';

export function loadSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: ignore */ }
}

export function clampScale(n: number): number {
  return Number.isFinite(n) ? Math.min(2, Math.max(1, n)) : 1;
}

/** Resolve "system" using the OS preference. */
export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): 'light' | 'dark' {
  return choice === 'system' ? (prefersDark ? 'dark' : 'light') : choice;
}

/** Push settings onto <html> so CSS tokens react. */
export function applySettings(s: Settings, root: HTMLElement = document.documentElement): void {
  const dark = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = resolveTheme(s.theme, dark);
  root.dataset.furigana = s.furigana ? 'on' : 'off';
  root.dataset.contrast = s.highContrast ? 'high' : 'normal';
  root.dataset.vertical = s.vertical ? 'on' : 'off';
  root.dataset.motion = s.reduceMotion ? 'reduce' : 'normal';
  root.style.setProperty('--font-scale', String(clampScale(s.fontScale)));
}

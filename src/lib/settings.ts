// User display settings. Persisted in localStorage (tiny, synchronous, safe to read before first paint).
export type ThemeChoice = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemeChoice;
  furigana: boolean;
  largeText: boolean;
  highContrast: boolean;
}

export const DEFAULT_SETTINGS: Settings = { theme: 'system', furigana: true, largeText: false, highContrast: false };
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
  root.style.setProperty('--font-scale', s.largeText ? '1.25' : '1');
}

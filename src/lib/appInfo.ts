// Facts about this build: its version, where updates come from, and which shell it runs in.
import { Capacitor } from '@capacitor/core';

declare const __APP_VERSION__: string;

export const APP_VERSION: string = __APP_VERSION__;
/** GitHub repo that publishes app Releases (.exe / .apk). */
export const APP_REPO = 'Fedya3012/Yomineko';
/** Where the content catalog is published (see docs/HUONG-DAN-XUAT-BAN-GOI.md). Override with VITE_CATALOG_URL. */
export const CATALOG_URL: string =
  (import.meta.env.VITE_CATALOG_URL as string | undefined) ?? 'https://fedya3012.github.io/Yomineko/content/catalog.json';

export type Platform = 'windows' | 'android' | 'web';

export function detectPlatform(): Platform {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) return 'windows';
  if (Capacitor.isNativePlatform()) return 'android';
  return 'web';
}

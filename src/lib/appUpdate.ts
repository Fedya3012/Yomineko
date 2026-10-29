// "Is there a newer app?" — asks GitHub Releases, the same place Obtainium and the manual downloads use.
import { compareVersions, isVersion } from './version';
import type { Platform } from './appInfo';

export interface AppUpdate {
  version: string;
  releaseUrl: string;      // the Release page
  downloadUrl?: string;    // direct file for this platform (.exe / .apk), when the release has one
  notes: string;
}
export type AppUpdateCheck =
  | { status: 'up-to-date' }
  | { status: 'available'; update: AppUpdate }
  | { status: 'error'; message: string };

interface GhRelease {
  tag_name?: string; html_url?: string; body?: string | null; draft?: boolean; prerelease?: boolean;
  assets?: { name: string; browser_download_url: string }[];
}

const assetFor = (platform: Platform, assets: GhRelease['assets'] = []) => {
  const ext = platform === 'windows' ? '.exe' : platform === 'android' ? '.apk' : '';
  return ext ? assets.find((a) => a.name.toLowerCase().endsWith(ext))?.browser_download_url : undefined;
};

export async function checkAppUpdate(
  current: string, repo: string, platform: Platform, fetchFn: typeof fetch = fetch
): Promise<AppUpdateCheck> {
  try {
    const res = await fetchFn(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (res.status === 404) return { status: 'up-to-date' }; // no release published yet
    if (!res.ok) return { status: 'error', message: `GitHub trả lỗi ${res.status}` };
    const rel = (await res.json()) as GhRelease;
    if (!rel.tag_name || !isVersion(rel.tag_name) || rel.draft || rel.prerelease) return { status: 'up-to-date' };
    if (compareVersions(rel.tag_name, current) <= 0) return { status: 'up-to-date' };
    return {
      status: 'available',
      update: {
        version: rel.tag_name.replace(/^v/, ''),
        releaseUrl: rel.html_url ?? `https://github.com/${repo}/releases/latest`,
        downloadUrl: assetFor(platform, rel.assets),
        notes: rel.body ?? ''
      }
    };
  } catch {
    return { status: 'error', message: 'Không có mạng hoặc không kết nối được GitHub' };
  }
}

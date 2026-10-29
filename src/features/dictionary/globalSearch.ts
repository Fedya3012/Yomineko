// Global search: dictionary results and the learner's own cards and notes, side by side.
//
// Other features plug their own data in with `registerSearchSource`, so this file never needs
// to know how SRS or notes store things. The built-in "user content" source reads:
//   - userdata keys  `card:<id>`  and  `note:<id>`   (cards / notes the learner made)
//   - records collection `cards`                     (cards that came with a deck pack)
// Shape (all optional except an id): { front, back, reading, text, title, tags[] } - any of these
// strings are searched.
import type { DB } from '../../lib/db';
import { normalize } from './kana';
import type { DictionaryIndex } from './index';

export type HitKind = 'word' | 'card' | 'note';
export interface GlobalHit {
  source: string;
  kind: HitKind;
  id: string;
  title: string;
  subtitle: string;
  score: number;
}
export interface SearchSource {
  id: string;
  label: string;
  search(query: string, limit: number): Promise<GlobalHit[]> | GlobalHit[];
}

const sources = new Map<string, SearchSource>();
export const registerSearchSource = (s: SearchSource) => { sources.set(s.id, s); return () => sources.delete(s.id); };
export const clearSearchSources = () => sources.clear();

export function dictionarySource(getIndex: () => DictionaryIndex | undefined): SearchSource {
  return {
    id: 'dictionary', label: 'Từ điển',
    search(query, limit) {
      return (getIndex()?.search(query, limit) ?? []).map(({ word, score }) => ({
        source: 'dictionary', kind: 'word' as const, id: word.id, score,
        title: word.kanji[0]?.text ?? word.kana[0]?.text ?? word.id,
        subtitle: `${word.kanji.length ? word.kana[0]?.text + ' · ' : ''}${word.senses[0]?.gloss.slice(0, 3).join('; ') ?? ''}`
      }));
    }
  };
}

type UserItem = { front?: string; back?: string; reading?: string; text?: string; title?: string; tags?: string[] };
const TEXT_FIELDS = ['front', 'back', 'reading', 'text', 'title'] as const;

function scoreItem(item: UserItem, q: string): number {
  let best = 0;
  for (const f of [...TEXT_FIELDS.map((k) => item[k]), ...(item.tags ?? [])]) {
    if (typeof f !== 'string') continue;
    const n = normalize(f);
    const at = n.indexOf(q);
    if (at < 0) continue;
    best = Math.max(best, n === q ? 900 : at === 0 ? 600 : 300);
  }
  return best;
}

export function userContentSource(db: DB): SearchSource {
  return {
    id: 'user', label: 'Thẻ & ghi chú của bạn',
    async search(query, limit) {
      const q = normalize(query);
      if (!q) return [];
      const hits: GlobalHit[] = [];
      const push = (kind: HitKind, id: string, item: UserItem, fallback: string) => {
        const score = scoreItem(item, q);
        if (!score) return;
        const title = item.front ?? item.title ?? item.text?.slice(0, 40) ?? fallback;
        const subtitle = item.back ?? (item.title ? item.text?.slice(0, 80) : undefined) ?? item.reading ?? '';
        hits.push({ source: 'user', kind, id, title, subtitle, score });
      };
      for (const [prefix, kind] of [['card:', 'card'], ['note:', 'note']] as const) {
        const range = IDBKeyRange.bound(prefix, prefix + '￿');
        const keys = (await db.getAllKeys('userdata', range)) as string[];
        const values = (await db.getAll('userdata', range)) as UserItem[];
        keys.forEach((k, i) => push(kind, k.slice(prefix.length), values[i] ?? {}, k));
      }
      for (const row of await db.getAllFromIndex('records', 'byCollection', 'cards')) {
        push('card', row.id, row.data as unknown as UserItem, row.id);
      }
      return hits.sort((a, b) => b.score - a.score).slice(0, limit);
    }
  };
}

export interface GlobalResults { dictionary: GlobalHit[]; user: GlobalHit[]; other: GlobalHit[] }

export async function searchAll(query: string, limit = 20): Promise<GlobalResults> {
  const out: GlobalResults = { dictionary: [], user: [], other: [] };
  await Promise.all([...sources.values()].map(async (s) => {
    const hits = await s.search(query, limit);
    (s.id === 'dictionary' ? out.dictionary : s.id === 'user' ? out.user : out.other).push(...hits);
  }));
  out.other.sort((a, b) => b.score - a.score);
  return out;
}

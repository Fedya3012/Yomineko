// Content shipped inside the app. Only book *frames* (no publisher text) and an original sample book.
import type { DB } from '../../lib/db';
import { installPack } from '../../lib/packs/install';
import type { PackFile } from '../../lib/packs/format';
import shells from '../../../packs-src/textbook-shells/v1.json';
import starter from '../../../packs-src/textbook-starter/v1.json';

export const BUNDLED_PACKS = [shells, starter] as unknown as PackFile[];

/** Installs the bundled packs that are not on this device yet. Never overwrites a newer or learner-edited book. */
export async function ensureBundledPacks(db: DB): Promise<void> {
  for (const p of BUNDLED_PACKS) {
    if (!(await db.get('packs', p.manifest.id))) await installPack(db, p);
  }
}

/** Offered as a download so learners can fill in their own book. Same format as any pack. */
export const TEMPLATE_PACK: PackFile = {
  manifest: {
    format: 1, id: 'my-textbook', kind: 'lesson', title: 'Giáo trình của tôi', version: 1,
    license: { name: 'Tự soạn, chỉ dùng cá nhân', url: 'https://example.org/my-own-notes', attribution: 'Do tôi tự gõ từ sách của mình' }
  },
  upserts: {
    textbooks: [{ id: 'my-textbook', title: 'Giáo trình của tôi', level: 'N5', lessonIds: ['my-textbook-l01'] }],
    'tb-lessons': [{
      id: 'my-textbook-l01', textbookId: 'my-textbook', order: 1, title: 'Bài 1',
      guide: ['Viết cách học bài này ở đây.'],
      vocab: [{ id: 'v1', word: '学生', reading: 'がくせい', meaning: 'sinh viên' }],
      grammar: [{ id: 'g1', title: 'Tên mẫu câu', pattern: 'N1 は N2 です', explanation: 'Giải thích ngắn.', examples: [{ ja: 'わたしは学生です。', vi: 'Tôi là sinh viên.' }] }],
      dialogues: [{ id: 'd1', title: 'Hội thoại', lines: [{ speaker: 'A', ja: 'はじめまして。', vi: 'Rất vui được gặp.' }] }],
      exercises: [{ id: 'e1', type: 'choice', prompt: 'わたし（　）学生です。', choices: ['は', 'を'], answer: 'は' }]
    }]
  }
};

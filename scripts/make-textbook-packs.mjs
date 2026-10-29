// Writes packs-src/textbook-shells/v1.json: EMPTY book frames (title + lesson numbers only).
// No text from any publisher is included; learners fill the frames with their own pack file.
// Usage: node scripts/make-textbook-packs.mjs
import { writeFileSync } from 'node:fs';

const books = [
  { id: 'mnn1', title: 'Minna no Nihongo I', titleJa: 'みんなの日本語 I', level: 'N5', lessons: 25 },
  { id: 'mnn2', title: 'Minna no Nihongo II', titleJa: 'みんなの日本語 II', level: 'N4', lessons: 25 },
  { id: 'genki1', title: 'Genki I', titleJa: 'げんき I', level: 'N5', lessons: 12 },
  { id: 'genki2', title: 'Genki II', titleJa: 'げんき II', level: 'N4', lessons: 11 }
];
const pad = (n) => String(n).padStart(2, '0');
const lessonId = (b, n) => `${b.id}-l${pad(n)}`;

const pack = {
  manifest: {
    format: 1, id: 'textbook-shells', kind: 'lesson', title: 'Khung giáo trình (Minna, Genki)', version: 1,
    license: { name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/', attribution: 'Chỉ gồm tên sách và số bài, do đội Yomineko viết. Không có nội dung của nhà xuất bản.' }
  },
  upserts: {
    textbooks: books.map((b) => ({ id: b.id, title: b.title, titleJa: b.titleJa, level: b.level,
      lessonIds: Array.from({ length: b.lessons }, (_, i) => lessonId(b, i + 1)) })),
    'tb-lessons': books.flatMap((b) => Array.from({ length: b.lessons }, (_, i) =>
      ({ id: lessonId(b, i + 1), textbookId: b.id, order: i + 1, title: `Bài ${i + 1}` })))
  }
};
writeFileSync('packs-src/textbook-shells/v1.json', JSON.stringify(pack, null, 1) + '\n');
console.log('textbook-shells.pack.json written');

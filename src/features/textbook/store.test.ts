import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { getUserData, listCollection, openDatabase, setUserData, type DB } from '../../lib/db';
import { loadCards } from '../srs/store';
import { uninstallPack } from '../../lib/packs/install';
import { validatePack } from '../../lib/packs/format';
import { loadOverview } from '../progress/store';
import { BUNDLED_PACKS, ensureBundledPacks, TEMPLATE_PACK } from './bundled';
import { lessonRatio } from './logic';
import { addLessonToSrs, buildCards, packId, srsCardCount } from './srs';
import { answerExercise, loadAudio, loadLessons, loadNotes, loadProgress, loadTextbooks, removeAudio, resetLesson, saveAudio, saveNotes, setSectionDone } from './store';
import type { Lesson } from './types';

let db: DB;
let n = 0;
beforeEach(async () => { db = await openDatabase(`textbook-test-${n++}`); });

async function starter(): Promise<Lesson> {
  await ensureBundledPacks(db);
  return (await loadLessons(db, 'starter'))[0];
}

describe('bundled content', () => {
  it('every bundled pack and the template are valid packs with a license', () => {
    for (const p of [...BUNDLED_PACKS, TEMPLATE_PACK]) expect(() => validatePack(p)).not.toThrow();
  });
  it('has Minna and Genki as empty frames: lesson numbers only', async () => {
    await ensureBundledPacks(db);
    const books = await loadTextbooks(db);
    expect(books.map((b) => b.id).sort()).toEqual(['genki1', 'genki2', 'mnn1', 'mnn2', 'starter']);
    expect(books.find((b) => b.id === 'mnn1')!.lessonIds).toHaveLength(25);
    expect(books.find((b) => b.id === 'genki1')!.lessonIds).toHaveLength(12);
    const frames = (await loadLessons(db, 'mnn1'));
    expect(frames.every((l) => Object.keys(l).sort().join() === 'id,order,textbookId,title')).toBe(true);
  });
  it('installing twice does not duplicate, and lessons come back in order', async () => {
    await ensureBundledPacks(db);
    await ensureBundledPacks(db);
    expect((await listCollection(db, 'tb-lessons')).length).toBe(25 + 25 + 12 + 11 + 2);
    expect((await loadLessons(db, 'starter')).map((l) => l.order)).toEqual([1, 2]);
  });
});

describe('lesson progress', () => {
  it('saves section ticks per lesson and can reset them', async () => {
    const l = await starter();
    await setSectionDone(db, l.id, 'guide', true);
    expect((await loadProgress(db, l.id)).done.guide).toBe(true);
    expect(lessonRatio(l, await loadProgress(db, l.id))).toBeGreaterThan(0);
    await resetLesson(db, l.id);
    expect((await loadProgress(db, l.id)).done).toEqual({});
  });

  it('finishing every exercise ticks practice and feeds the progress feature once', async () => {
    const l = await starter();
    for (const e of l.exercises!) await answerExercise(db, l, e.id, true);
    const p = await loadProgress(db, l.id);
    expect(p.done.practice).toBe(true);
    const o = await loadOverview(db);
    expect(o.counts.grammar).toBe(3);   // e1, e2, e4 are grammar items
    expect(o.counts.word).toBe(1);      // e3
    // Answering right again must not count a second "learned".
    await answerExercise(db, l, l.exercises![0].id, true);
    expect((await loadOverview(db)).counts.grammar).toBe(3);
  });

  it('a wrong answer is recorded as a weak point and a later right answer sticks', async () => {
    const l = await starter();
    const e = l.exercises![0];
    await answerExercise(db, l, e.id, false);
    expect((await loadProgress(db, l.id)).results[e.id]).toBe(false);
    await answerExercise(db, l, e.id, true);
    expect((await loadProgress(db, l.id)).results[e.id]).toBe(true);
    await answerExercise(db, l, e.id, false);          // slipping later keeps the earlier success
    expect((await loadProgress(db, l.id)).results[e.id]).toBe(true);
  });

  it('keeps learner data when the book pack is removed and reinstalled', async () => {
    const l = await starter();
    await setSectionDone(db, l.id, 'vocab', true);
    await saveNotes(db, l.id, 'ghi chú');
    await uninstallPack(db, 'textbook-starter');
    expect(await loadLessons(db, 'starter')).toEqual([]);
    await ensureBundledPacks(db);
    expect((await loadProgress(db, l.id)).done.vocab).toBe(true);
    expect(await loadNotes(db, l.id)).toBe('ghi chú');
  });
});

describe('SRS hand-off', () => {
  it('turns vocabulary and kanji into real SRS cards, and adding twice does not duplicate', async () => {
    const l = await starter();
    const cards = buildCards(l);
    expect(cards.filter((c) => c.kind === 'word')).toHaveLength(l.vocab!.length);
    expect(cards.filter((c) => c.kind === 'kanji')).toHaveLength(3);
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);

    expect(await addLessonToSrs(db, l)).toBe(cards.length);
    expect(await addLessonToSrs(db, l)).toBe(cards.length);
    const inSrs = (await loadCards(db)).filter((c) => c.id.startsWith(`${l.id}:`));
    expect(inSrs).toHaveLength(cards.length);
    expect(inSrs.every((c) => c.word && c.reading && c.meaning)).toBe(true);
    expect(await srsCardCount(db, l.id)).toBe(cards.length);
  });
  it('keeps each item\'s own source on its card, defaulting to the lesson source', async () => {
    const l = await starter();
    const lesson: Lesson = { ...l, source: { type: 'manga', title: 'X' }, vocab: [{ id: 'a', word: 'あ', meaning: 'a', source: { type: 'anime', title: 'One Piece', location: '12:31' } }, { id: 'b', word: 'い', meaning: 'b' }], kanji: [], grammar: [] };
    const [a, b] = buildCards(lesson);
    expect(a.source.origin).toEqual({ type: 'anime', title: 'One Piece', location: '12:31' });
    expect(b.source.origin).toEqual({ type: 'manga', title: 'X' });
  });
  it('removing the personal card pack keeps the learner\'s review history', async () => {
    const l = await starter();
    await addLessonToSrs(db, l);
    const id = `${l.id}:word:watashi`;
    await setUserData(db, `srs.state:${id}`, { cardId: id });
    await uninstallPack(db, packId(l.id));
    expect(await srsCardCount(db, l.id)).toBe(0);
    expect(await getUserData(db, `srs.state:${id}`)).toEqual({ cardId: id });
  });
  it('does nothing for an empty frame', async () => {
    await ensureBundledPacks(db);
    const frame = (await loadLessons(db, 'mnn1'))[0];
    expect(await addLessonToSrs(db, frame)).toBe(0);
    expect(await srsCardCount(db, frame.id)).toBe(0);
  });
});

describe('learner audio and notes', () => {
  it('stores the learner\'s own audio per lesson item and can remove it', async () => {
    const blob = new Blob(['x'], { type: 'audio/mpeg' });
    await saveAudio(db, 'l1', 'vocab-a', blob);
    expect(await loadAudio(db, 'l1', 'vocab-a')).toBeTruthy();
    expect(await loadAudio(db, 'l2', 'vocab-a')).toBeUndefined();
    await removeAudio(db, 'l1', 'vocab-a');
    expect(await loadAudio(db, 'l1', 'vocab-a')).toBeUndefined();
  });
});

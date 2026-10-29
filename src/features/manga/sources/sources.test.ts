import { zipSync, strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { openBook } from '../open';
import { openCbz } from './cbz';
import { pagesFromFiles } from './folder';

const assets = { libarchiveWorker: 'x', pdfWorker: 'y' };
const png = (tag: string) => strToU8(`PNG-${tag}`);
const text = (b: Blob) => b.text();

function makeCbz() {
  const zip = zipSync({
    'ch1/10.png': png('10'), 'ch1/2.png': png('2'), 'ch1/1.png': png('1'),
    '__MACOSX/ch1/._1.png': png('junk'), 'ComicInfo.xml': strToU8('<x/>')
  });
  return new File([zip as BlobPart], 'One Piece v1.cbz');
}

describe('CBZ', () => {
  it('lists pages in natural order and decompresses only the one asked for', async () => {
    const pages = await openCbz(makeCbz());
    expect(pages.map((p) => p.name)).toEqual(['ch1/1.png', 'ch1/2.png', 'ch1/10.png']);
    expect(await text(await pages[2].load())).toBe('PNG-10');
    expect((await pages[0].load()).type).toBe('image/png');
  });
});

describe('folder', () => {
  it('uses the folder name as title and sorts pages', async () => {
    const f = (path: string) => Object.defineProperty(new File([path], path.split('/').pop()!), 'webkitRelativePath', { value: path });
    const { pages, title } = pagesFromFiles([f('Berserk/p10.jpg'), f('Berserk/p2.jpg'), f('Berserk/readme.txt')]);
    expect(title).toBe('Berserk');
    expect(pages.map((p) => p.name)).toEqual(['Berserk/p2.jpg', 'Berserk/p10.jpg']);
  });
});

describe('openBook', () => {
  it('opens a CBZ file and gives it a stable id', async () => {
    const a = await openBook([makeCbz()], assets);
    const b = await openBook([makeCbz()], assets);
    expect(a).toMatchObject({ title: 'One Piece v1', format: 'cbz' });
    expect(a.pages).toHaveLength(3);
    expect(a.id).toBe(b.id);
  });

  it('opens a ZIP disguised as .cbr', async () => {
    const zip = new File([zipSync({ '1.png': png('1') }) as BlobPart], 'x.cbr');
    expect((await openBook([zip], assets)).format).toBe('cbz');
  });

  it('opens several loose images as one book', async () => {
    const book = await openBook([new File(['a'], 'b.png'), new File(['a'], 'a.png')], assets);
    expect(book.format).toBe('images');
    expect(book.pages.map((p) => p.name)).toEqual(['a.png', 'b.png']);
  });

  it('gives friendly errors', async () => {
    await expect(openBook([], assets)).rejects.toThrow('Chưa chọn');
    await expect(openBook([new File(['hello'], 'note.docx')], assets)).rejects.toThrow('chưa hỗ trợ');
    await expect(openBook([new File([zipSync({ 'a.txt': png('x') }) as BlobPart], 'e.cbz')], assets)).rejects.toThrow('Không tìm thấy');
  });
});

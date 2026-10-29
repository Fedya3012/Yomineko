// Kiểu dữ liệu của mô-đun Kana & Kanji. Khớp với gói kana-core và kanji-grade1.
export type Script = 'hiragana' | 'katakana';

export interface Kana {
  id: string;            // "hira:あ" | "kata:ア"
  char: string;
  script: Script;
  romaji: string;
  row: string;           // "a", "ka", "sa"...
  kind: 'basic' | 'dakuten';
  strokes: string[];     // đường nét SVG (hệ toạ độ 109x109 của KanjiVG), theo đúng thứ tự viết
}

export interface Kanji {
  id: string;
  char: string;
  grade: number;
  jlpt: string | null;
  vi: string;            // "Nhật · mặt trời, ngày"
  meaningsEn: string[];
  onyomi: string[];      // âm On (katakana trong KANJIDIC, ở đây là hiragana của dữ liệu nguồn)
  kunyomi: string[];     // âm Kun, dấu "." ngăn phần okurigana, "-" là hậu tố/tiền tố
  radical: { char: string; name: string };
  mnemonic: string;
  examples: { ja: string; reading: string; vi: string }[];
  strokes: string[];
}

/** Thẻ để SRS dùng; bản ghi nằm trong collection "cards". */
export interface Card {
  id: string;
  deck: string;
  type: 'kana' | 'kanji';
  front: string;
  back: string;
  ref: { collection: 'kana' | 'kanji'; id: string };
}

export interface Point { x: number; y: number }

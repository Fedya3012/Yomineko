import type { Style } from './types';

export interface Persona {
  id: string;
  kind: 'anime' | 'animal';
  name: string;
  glyph: string; // placeholder avatar; swap for artwork later without touching logic
  tone: 'coral' | 'teal' | 'mint' | 'sky';
  blurb: string;
  defaultStyle: Style;
}

// All characters are original. No copyrighted anime characters are used.
export const PERSONAS: Persona[] = [
  { id: 'mochi', kind: 'animal', name: 'Mochi', glyph: '🐱', tone: 'coral', blurb: 'Mèo trắng may mắn, mascot của Yomineko', defaultStyle: 'gentle' },
  { id: 'kitsune', kind: 'animal', name: 'Kon', glyph: '🦊', tone: 'sky', blurb: 'Cáo tinh nghịch, hay đố vui', defaultStyle: 'cheerful' },
  { id: 'shiba', kind: 'animal', name: 'Shiba', glyph: '🐶', tone: 'mint', blurb: 'Cún Shiba nhiệt tình, luôn cổ vũ', defaultStyle: 'cheerful' },
  { id: 'usagi', kind: 'animal', name: 'Usagi', glyph: '🐰', tone: 'teal', blurb: 'Thỏ nhỏ nhẹ nhàng, kiên nhẫn', defaultStyle: 'gentle' },
  { id: 'sakura', kind: 'anime', name: 'Sakura', glyph: '👧', tone: 'coral', blurb: 'Cô bạn cùng lớp anime, vui tính', defaultStyle: 'cheerful' },
  { id: 'haruto', kind: 'anime', name: 'Haruto', glyph: '🧑', tone: 'sky', blurb: 'Chàng trai điềm đạm, giải thích rõ ràng', defaultStyle: 'gentle' },
  { id: 'sensei', kind: 'anime', name: 'Tanaka-sensei', glyph: '👩‍🏫', tone: 'mint', blurb: 'Cô giáo nghiêm nhưng thương học trò', defaultStyle: 'strict' }
];

export const DEFAULT_PERSONA_ID = 'mochi';

export function getPersona(id: string): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];
}

export const STYLE_LABELS: Record<Style, string> = {
  gentle: 'Dịu dàng',
  cheerful: 'Năng động',
  strict: 'Nghiêm khắc nhưng thương'
};

/** Short phrases per speaking style, used by the offline engine and the AI system prompt. */
export const PHRASES: Record<Style, { greet: string[]; praise: string[]; retry: string[]; cheer: string[] }> = {
  gentle: {
    greet: ['Chào bạn, hôm nay mình học một chút nhé? 🌸', 'Mình ở đây rồi. Cứ hỏi thoải mái nhé.'],
    praise: ['Giỏi lắm, bạn làm tốt đấy!', 'Đúng rồi, rất tự nhiên!'],
    retry: ['Không sao đâu, mình thử lại cùng nhau nhé.', 'Gần đúng rồi, chỉ cần chỉnh một chút thôi.'],
    cheer: ['Mỗi ngày một chút là đủ. Bạn đang tiến bộ đấy!', 'Sai cũng không sao, đó là cách não ghi nhớ.']
  },
  cheerful: {
    greet: ['Yo! Sẵn sàng học chưa? 🎉', 'Chào chào! Hôm nay mình chinh phục câu mới nhé!'],
    praise: ['Tuyệt vời! Quá đỉnh luôn! ✨', 'Chuẩn không cần chỉnh! 👏'],
    retry: ['Suýt nữa! Thử lại lần nữa nào!', 'Ối, gần rồi! Mình sửa nhanh nhé!'],
    cheer: ['Cố lên! Bạn làm được mà! 💪', 'Một câu nữa thôi, đừng bỏ cuộc nhé!']
  },
  strict: {
    greet: ['Vào học đi. Hôm nay em muốn ôn gì?', 'Đúng giờ đấy. Bắt đầu thôi.'],
    praise: ['Tốt. Giữ phong độ này.', 'Chính xác. Cô hài lòng.'],
    retry: ['Chưa chính xác. Đọc kỹ lại rồi sửa.', 'Lỗi này hay gặp, chú ý lần sau nhé.'],
    cheer: ['Chăm chỉ mỗi ngày mới giỏi được. Đừng lười.', 'Cô tin em làm được, nhưng phải luyện tập.']
  }
};

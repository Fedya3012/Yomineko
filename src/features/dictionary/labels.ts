// Vietnamese labels for JMdict part-of-speech codes. Unknown codes are shown as-is.
const POS: Record<string, string> = {
  n: 'danh từ', 'n-adv': 'danh từ (trạng từ)', 'n-t': 'danh từ thời gian', 'n-suf': 'hậu tố', 'n-pref': 'tiền tố',
  pn: 'đại từ', adj: 'tính từ', 'adj-i': 'tính từ -i', 'adj-na': 'tính từ -na', 'adj-no': 'tính từ -no',
  'adj-f': 'từ bổ nghĩa danh từ', adv: 'trạng từ', 'adv-to': 'trạng từ (と)', conj: 'liên từ', int: 'thán từ',
  prt: 'trợ từ', pref: 'tiền tố', suf: 'hậu tố', ctr: 'lượng từ', exp: 'cụm từ', aux: 'trợ động từ',
  'aux-v': 'trợ động từ', 'aux-adj': 'trợ tính từ', cop: 'hệ từ', num: 'số từ', unc: 'chưa phân loại',
  vs: 'động từ する', 'vs-i': 'động từ する', 'vs-s': 'động từ する', vk: 'động từ 来る', vi: 'tự động từ', vt: 'tha động từ',
  v1: 'động từ nhóm 2 (ichidan)', 'v1-s': 'động từ nhóm 2 (ichidan)', vz: 'động từ nhóm 2 (ずる)', vr: 'động từ -ru bất quy tắc'
};
export function posLabel(code: string): string {
  if (POS[code]) return POS[code];
  if (/^v5/.test(code)) return 'động từ nhóm 1 (godan)';
  if (/^v4/.test(code)) return 'động từ nhóm 4 (cổ)';
  return code;
}
/** Collapse duplicate labels ("vs-i" + "vs-s") for display. */
export const posLabels = (codes: string[]) => [...new Set(codes.map(posLabel))];

// Usage tags Jitendex puts on senses (JMdict misc / field / dialect codes). Unknown codes are shown as-is.
const TAGS: Record<string, string> = {
  uk: 'thường viết bằng kana', abbr: 'viết tắt', arch: 'cổ', col: 'khẩu ngữ', fam: 'thân mật', hon: 'kính ngữ',
  hum: 'khiêm nhường', pol: 'lịch sự', sl: 'tiếng lóng', vulg: 'thô tục', derog: 'miệt thị', obs: 'lỗi thời',
  obsc: 'ít người biết', rare: 'hiếm', poet: 'thơ ca', id: 'thành ngữ', 'on-mim': 'từ tượng thanh/tượng hình',
  yoji: 'thành ngữ 4 chữ', proverb: 'tục ngữ', male: 'lời nam', fem: 'lời nữ', chn: 'ngôn ngữ trẻ em', joc: 'đùa vui',
  food: 'ẩm thực', med: 'y học', comp: 'tin học', math: 'toán học', law: 'luật', mus: 'âm nhạc', sports: 'thể thao',
  baseb: 'bóng chày', sumo: 'sumo', Buddh: 'Phật giáo', Shinto: 'Thần đạo', geol: 'địa chất', bot: 'thực vật',
  zool: 'động vật', anat: 'giải phẫu', chem: 'hoá học', physics: 'vật lý', econ: 'kinh tế', ling: 'ngôn ngữ học',
  tsb: 'phương ngữ Tosa', kyb: 'phương ngữ Kyoto', ksb: 'phương ngữ Kansai', osb: 'phương ngữ Osaka'
};
export const tagLabel = (code: string) => TAGS[code] ?? code;

export const jlptLabel = (n: number) => `N${n}`;
export function freqLabel(common: boolean, rank?: number): string | null {
  if (rank) return rank <= 2000 ? `Rất thường gặp · #${rank}` : `Thường gặp · #${rank}`;
  return common ? 'Thường gặp' : null;
}

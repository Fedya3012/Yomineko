// Open licenses of the data Yomineko uses. Shown in the app (Dictionary > Giấy phép & ghi công).
// Rule: nothing is stored unless it is listed here with an open license.
export interface DataLicense {
  id: string;
  name: string;          // data set
  by: string;            // who made it
  license: string;
  licenseUrl: string;
  url: string;           // home page of the data set
  note: string;          // what we use it for (Vietnamese)
}

export const DATA_LICENSES: DataLicense[] = [
  {
    id: 'jmdict', name: 'JMdict', by: 'Electronic Dictionary Research and Development Group (EDRDG)',
    license: 'CC BY-SA 4.0', licenseUrl: 'https://www.edrdg.org/edrdg/licence.html', url: 'https://www.edrdg.org/jmdict/j_jmdict.html',
    note: 'Từ vựng, cách đọc, nghĩa tiếng Anh, loại từ.'
  },
  {
    id: 'kanjidic', name: 'KANJIDIC2', by: 'Electronic Dictionary Research and Development Group (EDRDG)',
    license: 'CC BY-SA 4.0', licenseUrl: 'https://www.edrdg.org/edrdg/licence.html', url: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project',
    note: 'Âm On/Kun, nghĩa, số nét, cấp lớp và độ thường gặp của chữ Hán.'
  },
  {
    id: 'tatoeba', name: 'Tatoeba (câu ví dụ)', by: 'Tatoeba contributors',
    license: 'CC BY 2.0 FR', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/fr/', url: 'https://tatoeba.org',
    note: 'Câu ví dụ có kèm bản dịch tiếng Anh.'
  },
  {
    id: 'jlpt-lists', name: 'Danh sách từ vựng JLPT', by: 'Jonathan Waller (tanos.co.uk)',
    license: 'CC BY', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', url: 'https://www.tanos.co.uk/jlpt/',
    note: 'Gán cấp độ N5–N1. Đây là danh sách không chính thức (JLPT không công bố danh sách chính thức).'
  }
];

export const SHARE_ALIKE_NOTE =
  'Dữ liệu từ điển dùng giấy phép chia sẻ tương tự (CC BY-SA): gói dữ liệu đã chỉnh sửa vẫn phải giữ nguyên giấy phép này. ' +
  'Mã nguồn ứng dụng nằm riêng, không bị ràng buộc bởi giấy phép của dữ liệu.';

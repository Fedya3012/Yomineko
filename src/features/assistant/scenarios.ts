// Role-play scenarios. Each turn: what the other person says, a Vietnamese gloss,
// keywords that show the learner is on track, and a model answer.
export interface Turn { npc: string; gloss: string; expect: string[]; model: string; modelGloss: string }
export interface Scenario { id: string; title: string; place: string; level: 'N5' | 'N4'; turns: Turn[] }

export const SCENARIOS: Scenario[] = [
  {
    id: 'konbini', title: 'Ở cửa hàng tiện lợi', place: 'cửa hàng tiện lợi (コンビニ)', level: 'N5',
    turns: [
      { npc: 'いらっしゃいませ。お弁当は温めますか。', gloss: 'Xin chào quý khách. Có hâm nóng cơm hộp không ạ?', expect: ['はい', 'お願い', 'ください', 'いいえ', '大丈夫'], model: 'はい、お願いします。', modelGloss: 'Vâng, nhờ bạn.' },
      { npc: 'お箸はつけますか。', gloss: 'Có lấy đũa không ạ?', expect: ['はい', 'お願い', 'ください', 'いいえ', 'いりません', '大丈夫'], model: 'はい、ください。', modelGloss: 'Vâng, cho tôi đũa.' },
      { npc: '五百円です。', gloss: 'Của bạn 500 yên.', expect: ['はい', 'ありがとう', 'お願い', 'カード', '円'], model: 'はい、これでお願いします。', modelGloss: 'Vâng, tôi trả bằng cái này.' }
    ]
  },
  {
    id: 'restaurant', title: 'Gọi món ở nhà hàng', place: 'nhà hàng (レストラン)', level: 'N5',
    turns: [
      { npc: 'いらっしゃいませ。何名様ですか。', gloss: 'Xin chào. Quý khách đi mấy người ạ?', expect: ['人', 'ひとり', 'ふたり', '二', '一'], model: '二人です。', modelGloss: 'Hai người.' },
      { npc: 'ご注文はお決まりですか。', gloss: 'Quý khách đã chọn món chưa ạ?', expect: ['ください', 'お願い', 'ラーメン', 'カレー', 'をひとつ'], model: 'ラーメンをひとつください。', modelGloss: 'Cho tôi một tô ramen.' },
      { npc: 'お飲み物はいかがですか。', gloss: 'Quý khách dùng đồ uống gì không ạ?', expect: ['水', 'お茶', 'ください', 'いいえ', '大丈夫'], model: 'お水をください。', modelGloss: 'Cho tôi nước lọc.' }
    ]
  },
  {
    id: 'intro', title: 'Tự giới thiệu', place: 'buổi gặp mặt đầu tiên', level: 'N5',
    turns: [
      { npc: 'はじめまして。お名前は何ですか。', gloss: 'Rất vui được gặp. Tên bạn là gì?', expect: ['です', '名前', 'はじめまして'], model: 'はじめまして。ミンです。', modelGloss: 'Rất vui được gặp. Tôi là Minh.' },
      { npc: 'どこから来ましたか。', gloss: 'Bạn đến từ đâu?', expect: ['から', 'ベトナム', '来ました', 'です'], model: 'ベトナムから来ました。', modelGloss: 'Tôi đến từ Việt Nam.' },
      { npc: '趣味は何ですか。', gloss: 'Sở thích của bạn là gì?', expect: ['趣味', '好き', 'です', 'マンガ', 'アニメ'], model: '趣味はアニメを見ることです。', modelGloss: 'Sở thích của tôi là xem anime.' }
    ]
  },
  {
    id: 'directions', title: 'Hỏi đường ra ga', place: 'trên phố', level: 'N4',
    turns: [
      { npc: 'こんにちは。どうしましたか。', gloss: 'Chào bạn. Có chuyện gì vậy?', expect: ['すみません', '駅', 'どこ', 'ですか'], model: 'すみません、駅はどこですか。', modelGloss: 'Xin lỗi, nhà ga ở đâu ạ?' },
      { npc: 'まっすぐ行って、二つ目の角を右に曲がってください。', gloss: 'Đi thẳng, rẽ phải ở góc thứ hai.', expect: ['ありがとう', '右', 'わかりました', 'はい'], model: 'わかりました。ありがとうございます。', modelGloss: 'Tôi hiểu rồi. Cảm ơn bạn.' },
      { npc: '歩いて五分ぐらいですよ。', gloss: 'Đi bộ khoảng 5 phút thôi.', expect: ['ありがとう', 'はい', '助かり'], model: 'ご親切にありがとうございました。', modelGloss: 'Cảm ơn sự tử tế của bạn.' }
    ]
  }
];

export const getScenario = (id: string) => SCENARIOS.find((s) => s.id === id);

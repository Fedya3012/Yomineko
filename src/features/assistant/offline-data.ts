// Canned help that works with no internet and no AI. Hand-written, original explanations.

export interface GrammarNote { id: string; title: string; keys: string[]; body: string }

export const GRAMMAR: GrammarNote[] = [
  { id: 'wa', title: 'は (wa): chủ đề câu', keys: ['は', 'wa'], body: 'は đánh dấu chủ đề: "còn về X thì...".\nVí dụ: 私は学生です。(Tôi là học sinh.)\nĐọc là "wa" chứ không phải "ha".' },
  { id: 'ga', title: 'が (ga): chủ ngữ / đối tượng được thích', keys: ['が', 'ga'], body: 'が chỉ chủ ngữ mới hoặc cần nhấn mạnh, và đi với 好き, 上手, わかる, ある, いる.\nVí dụ: 猫が好きです。(Tôi thích mèo.)' },
  { id: 'wo', title: 'を (wo): tân ngữ trực tiếp', keys: ['を'], body: 'を đứng sau đối tượng của hành động.\nVí dụ: 水を飲みます。(Uống nước.)' },
  { id: 'ni', title: 'に: đích đến, thời điểm, người nhận', keys: ['に'], body: 'に chỉ thời điểm cụ thể, nơi đến, nơi tồn tại và người nhận.\nVí dụ: 七時に起きます。/ 学校に行きます。/ 友達にあげます。' },
  { id: 'de', title: 'で: nơi diễn ra hành động, phương tiện', keys: ['で'], body: 'で chỉ nơi hành động xảy ra hoặc dụng cụ/phương tiện.\nVí dụ: 図書館で勉強します。/ バスで行きます。' },
  { id: 'e', title: 'へ (e): hướng đi', keys: ['へ'], body: 'へ đọc là "e", chỉ hướng. Gần giống に khi đi với 行く, 来る, 帰る.\nVí dụ: 日本へ行きます。' },
  { id: 'no', title: 'の: sở hữu, bổ nghĩa danh từ', keys: ['の'], body: 'Nối hai danh từ: A の B = B của A.\nVí dụ: 私の本。(Sách của tôi.)' },
  { id: 'mo', title: 'も: cũng', keys: ['も'], body: 'も thay は/が/を khi "cũng".\nVí dụ: 私も学生です。(Tôi cũng là học sinh.)' },
  { id: 'masu', title: '〜ます: thể lịch sự', keys: ['ます', 'masu'], body: 'Động từ thể lịch sự. Phủ định ません, quá khứ ました, quá khứ phủ định ませんでした.\nVí dụ: 食べます / 食べません / 食べました。' },
  { id: 'te', title: '〜て: thể て', keys: ['て形', 'て', 'te-form'], body: 'Dùng để nối hành động, nhờ vả (〜てください), đang làm (〜ている).\nVí dụ: 食べて、寝ます。/ 見てください。' },
  { id: 'nai', title: '〜ない: phủ định thân mật', keys: ['ない'], body: 'Thể phủ định thường. Nhóm 2: bỏ る thêm ない (食べない). Nhóm 1: đổi âm cuối sang hàng あ (飲む → 飲まない).' },
  { id: 'ta', title: '〜た: quá khứ thân mật', keys: ['た形', 'た'], body: 'Quá khứ thường, chia giống thể て nhưng て thành た.\nVí dụ: 食べた / 行った / 飲んだ。' },
  { id: 'tai', title: '〜たい: muốn làm', keys: ['たい'], body: 'Bỏ ます, thêm たい. Ví dụ: 食べたい (muốn ăn). Chia như tính từ い.' },
  { id: 'teiru', title: '〜ている: đang làm / trạng thái', keys: ['ている', 'ていま'], body: 'Hành động đang diễn ra hoặc trạng thái kéo dài.\nVí dụ: 本を読んでいます。/ 結婚しています。' },
  { id: 'desu', title: 'です / だ', keys: ['です', 'だ'], body: 'です là "là" lịch sự, だ là dạng thường. Tính từ い cũng thêm です cho lịch sự: 高いです。' },
  { id: 'adj', title: 'Tính từ い và な', keys: ['形容詞', 'tính từ', 'い形容詞', 'な形容詞'], body: 'Tính từ い đứng trực tiếp trước danh từ (高い山). Tính từ な cần な (静かな町). 好き, きれい, 有名 là tính từ な.' }
];

export const TOPIC_LIST = GRAMMAR.map((g) => g.title).join('\n• ');

const MASU: Record<string, string> = {
  食べる: '食べます', 飲む: '飲みます', 行く: '行きます', 来る: '来ます', する: 'します', 見る: '見ます',
  読む: '読みます', 書く: '書きます', 話す: '話します', 聞く: '聞きます', たべる: 'たべます', のむ: 'のみます', いく: 'いきます'
};

export interface CorrectionRule { id: string; test: RegExp; replace: string | ((...m: string[]) => string); tip: string }

export const CORRECTION_RULES: CorrectionRule[] = [
  { id: 'punct-period', test: /\.(?=\s|$)/g, replace: '。', tip: 'Tiếng Nhật dùng dấu chấm 。 thay cho "." .' },
  { id: 'punct-comma', test: /,/g, replace: '、', tip: 'Dùng dấu phẩy 、 thay cho "," .' },
  { id: 'wo-suki', test: /を(好き|すき|上手|じょうず|下手|へた)/g, replace: 'が$1', tip: '好き/上手/下手 đi với が, không dùng を.' },
  { id: 'wo-iku', test: /を(行き|行く|いき|いく|来|帰)/g, replace: 'に$1', tip: 'Đi/đến/về dùng に (hoặc へ) chỉ nơi đến, không dùng を.' },
  { id: 'verb-desu', test: /(食べる|飲む|行く|来る|する|見る|読む|書く|話す|聞く|たべる|のむ|いく)です/g, replace: (_m, v) => MASU[v] ?? v, tip: 'Thể từ điển + です là sai. Động từ lịch sự phải chia thành 〜ます (食べる → 食べます).' },
  { id: 'ru-masu', test: /(食べ|見|寝|起き|出|教え|覚え)る(ます|ました|ません)/g, replace: '$1$2', tip: 'Khi thêm ます phải bỏ る của động từ nhóm 2: 食べます, không phải 食べるます.' },
  { id: 'na-adj', test: /(きれい|静か|しずか|有名|ゆうめい|元気|げんき|好き|すき)い(です|ね|よ|。|$)/g, replace: '$1$2', tip: 'Tính từ な (きれい, 静か, 好き...) không thêm い trước です.' },
  { id: 'i-adj-na', test: /(おいしい|高い|安い|やすい|大きい|おおきい|小さい|ちいさい|新しい|あたらしい)な(?![あぁ])/g, replace: '$1', tip: 'Tính từ い đứng trực tiếp trước danh từ, không thêm な.' }
];

export const CHAT_REPLIES: { keys: string[]; ja: string; vi: string }[] = [
  { keys: ['こんにちは', 'konnichiwa', 'xin chào', 'chào'], ja: 'こんにちは！', vi: 'Xin chào! Thử tự giới thiệu: 「はじめまして。〇〇です。」' },
  { keys: ['おはよう'], ja: 'おはようございます！', vi: 'Chào buổi sáng! Với bạn bè thì chỉ cần 「おはよう」.' },
  { keys: ['こんばんは'], ja: 'こんばんは！', vi: 'Chào buổi tối!' },
  { keys: ['ありがとう', 'cảm ơn', 'cam on'], ja: 'どういたしまして！', vi: 'Không có gì! (どういたしまして)' },
  { keys: ['つかれた', '疲れた', 'mệt'], ja: 'おつかれさま！', vi: 'Vất vả rồi! Nghỉ một chút rồi học tiếp nhé.' },
  { keys: ['すみません', 'xin lỗi'], ja: '大丈夫ですよ。', vi: 'Không sao đâu! (大丈夫ですよ)' },
  { keys: ['さようなら', 'じゃあね', 'tạm biệt'], ja: 'またね！', vi: 'Hẹn gặp lại! (またね)' }
];

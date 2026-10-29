# Mô-đun Kana & Kanji (cho các thread khác)

Mã: `src/features/kana-kanji/`. Mở từ thẻ "Kana & Kanji" ở trang chủ (`KanaKanjiApp.svelte`).

## Nội dung (gói, dữ liệu mở)
Tạo bằng `node scripts/build-kana-kanji-packs.mjs` (cần mạng lần đầu), kết quả là `packs-src/kana-core/v1.json` và `packs-src/kanji-grade1/v1.json` (theo cách đăng gói trong `docs/HUONG-DAN-XUAT-BAN-GOI.md`):
| Gói | Chứa | Nguồn / giấy phép |
|---|---|---|
| `kana-core` | collection `kana` (hiragana + katakana, kể cả chữ đục, 142 chữ), `decks`, `cards` | nét viết: KanjiVG, CC BY-SA 3.0 |
| `kanji-grade1` | collection `kanji` (80 chữ lớp 1), `decks`, `cards` | cách đọc/nghĩa: KANJIDIC (EDRDG, CC BY-SA 4.0, qua bản JSON của David Gouveia); nét: KanjiVG; nghĩa tiếng Việt, truyện gợi nhớ, câu ví dụ: Yomineko tự viết (`scripts/kanji-curated.mjs`) |

Muốn thêm kanji lớp 2, 3...: thêm mục vào `kanji-curated.mjs`, đổi điều kiện `grade === 1` trong script, rồi **không sửa v1**: thêm file `v2.json` (version 2) để người dùng nhận bản cập nhật nhỏ. Không bao giờ nhét dữ liệu có bản quyền vào gói.

## Nối với SRS
- Thẻ nằm trong collection `cards` (`{ id, deck, type: 'kana'|'kanji', front, back, ref: { collection, id } }`), bộ thẻ trong `decks`.
- Chữ nào người học đánh dấu "đã thuộc" (hoặc viết đạt từ 1 sao) được ghi vào userdata `kanji.known` và `kana.known` (mảng id).
- `getIntroducedCards(db)` (trong `model.ts`) trả về các thẻ tương ứng: SRS dùng danh sách này để biết thẻ nào cần đưa vào lịch ôn. Thread kana/kanji **không** ghi `srs.state:*`.
- Điểm luyện viết lưu ở `kanji.practice` (`{ [id]: { best, stars, tries } }`).

## Chấm nét viết tay (`scoring.ts`)
Toạ độ hệ 109×109 của KanjiVG. Nét người học và nét chuẩn được lấy lại 32 điểm cách đều, rồi đo khoảng cách trung bình; có phát hiện viết ngược chiều, nét quá ngắn, nét chấm, và viết sai thứ tự nét. Ngưỡng đạt 60 điểm (`PASS_SCORE`), dung sai `TOLERANCE` chỉnh được ở đầu file nếu thấy chấm khắt khe hay dễ quá khi thử trên điện thoại.

## Âm thanh
`speech.ts` dùng giọng đọc tiếng Nhật có sẵn của máy (Web Speech API), không bundle file âm thanh. Nếu máy chưa cài giọng Nhật, bài "Nghe và chọn chữ" sẽ báo cho người học.

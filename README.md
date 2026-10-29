# Yomineko 読み猫

Ứng dụng học tiếng Nhật qua manga và anime, với chú mèo trắng **Mochi** đồng hành.
Chạy được trên **Windows (.exe)**, **Android (.apk)** và **trình duyệt (PWA)**, dùng được khi không có mạng.

> Dự án này do Claude viết hoàn toàn. Bạn không cần biết code: mọi thứ dưới đây chỉ là bấm nút trên GitHub.

## Cách lấy app (không cần cài gì lên máy tính)

| Bạn muốn | Làm thế nào |
|---|---|
| **Dùng bản web** | Sau khi bật GitHub Pages (xem dưới), mở `https://fedya3012.github.io/Yomineko/`. Trên điện thoại chọn "Thêm vào màn hình chính". |
| **Bản Windows** | Vào tab **Releases** của repo, tải file `Yomineko_..._x64-setup.exe`, bấm đúp để cài. |
| **Bản Android** | Vào tab **Releases**, tải `Yomineko.apk`. Hoặc thêm repo vào **Obtainium** để tự cập nhật (xem dưới). |

## Thiết lập một lần duy nhất

1. **Bật web (GitHub Pages):** repo → *Settings* → *Pages* → mục *Source* chọn **GitHub Actions**.
2. **Tạo khoá ký APK** (để Obtainium cập nhật được). Nhờ Claude làm giúp: *"Tạo khoá ký Android cho Yomineko"*. Claude sẽ hướng dẫn thêm 3 "Secrets" vào *Settings → Secrets and variables → Actions*: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`. Nếu chưa làm, APK vẫn cài được nhưng **không cập nhật đè** được lên bản sau.
3. **Phát hành bản mới:** nhờ Claude "tạo release v0.1.0" (thực chất là đặt một thẻ tên `v0.1.0`). GitHub tự build ra .exe, .apk, .zip web trong khoảng 15–20 phút.

## Dùng Obtainium (Android)

Cài Obtainium → *Add App* → dán `https://github.com/Fedya3012/Yomineko` → *Add*. Mỗi lần có Release mới, Obtainium sẽ báo cập nhật.

## Cập nhật nội dung mà không cần bản app mới

Nội dung học (từ điển, bộ kanji, bài học...) nằm trong **gói nội dung** (*content pack*), tải và cập nhật riêng, từng phần nhỏ. Tiến độ học của bạn được lưu tách biệt nên cập nhật nội dung không bao giờ làm mất tiến độ. Khi có bản mới, app tự hiện thông báo *"Có bản mới"* trong mục **Cập nhật**.

- Muốn đăng nội dung mới: xem **[Hướng dẫn đăng gói nội dung](docs/HUONG-DAN-XUAT-BAN-GOI.md)** (hoặc nhờ Claude làm giúp).
- Chi tiết kỹ thuật: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

**Từ điển Jitendex (tuỳ chọn):** mở **Từ điển → Từ điển Jitendex → Kiểm tra gói Jitendex → Cài** (khoảng 27 MB, tải một lần rồi dùng offline). Sau đó cửa sổ tra từ có thanh chọn nguồn nghĩa: *JMdict*, *Jitendex* hoặc *Cả hai*; Jitendex chia nghĩa theo loại từ, có ghi chú cách dùng và câu ví dụ cho từng nghĩa. Jitendex © Stephen Kraus, giấy phép **CC BY-SA 4.0**, dựng trên JMdict (EDRDG) và câu ví dụ Tatoeba (CC BY 2.0 FR); thông tin này cũng nằm trong mục *Giấy phép & ghi công dữ liệu* của app. Gói được dựng lại mỗi lần web được đăng (`scripts/build-jitendex-pack.mjs`).

**Về bản quyền:** app *không* kèm sẵn manga, anime hay giáo trình có bản quyền. Bạn tự nạp file của mình. Gói nội dung chỉ dùng dữ liệu mở (JMdict, KANJIDIC, Jitendex...), luôn ghi rõ giấy phép.

## Học theo giáo trình (Minna no Nihongo, Genki...)

Mở app → thẻ **Học theo giáo trình**. Chọn sách, thấy mục lục các bài theo thứ tự; mỗi bài có: cách học, từ vựng + kanji (có nút nghe), ngữ pháp kèm ví dụ, hội thoại (nghe + chữ + bản dịch), bài tập, chỗ dành cho video ngắn, ghi chú riêng và thanh tiến độ. Nút **Đưa vào thẻ ôn** thêm từ vựng và kanji của bài vào bộ thẻ SRS, và bài tập tự cập nhật phần **Tiến độ** (chuỗi ngày, từ đã học, điểm yếu).

**Về bản quyền (rất quan trọng):** Minna no Nihongo và Genki có bản quyền, nên repo và app **không chứa** chữ, hội thoại hay âm thanh của các sách này. Thứ có sẵn:
- **Khung sách**: chỉ tên sách và số bài (Minna I/II, Genki I/II). Các bài trống, ghi rõ "chưa có nội dung".
- **Giáo trình mẫu Yomineko**: 2 bài do chúng tôi tự viết (CC0) để thử.
- **Bạn tự nạp** nội dung từ sách của mình: bấm *Tải file mẫu để điền*, điền (hoặc nhờ Claude điền giúp từ sách bạn đã mua), rồi *Thêm giáo trình (nạp file)*. Nếu dùng id `mnn1-l01`, `genki1-l01`... thì file của bạn sẽ lấp vào đúng khung bài.
- **Đọc sách PDF/EPUB của bạn trong app**: ở trang sách bấm *Mở file sách của bạn (PDF/EPUB)*, hoặc ở tủ sách bấm *Thêm giáo trình* rồi chọn thẳng file PDF/EPUB (sẽ tạo một sách mới). Sau đó bấm *Đọc sách*. Trong màn hình đọc, đứng ở trang đầu của một bài rồi bấm *Gắn* để nối bài với trang đó; từ bài học, nút *Mở trang sách* nhảy thẳng tới trang. File nằm trong máy bạn, không tải lên đâu cả, và không bao giờ nằm trong repo. Chưa hỗ trợ: DjVu, CBZ, tìm trong sách, OCR.
- **Nguồn gốc từng mục**: từ vựng, kanji, mẫu ngữ pháp và câu hội thoại đều hiện nhãn nguồn (giáo trình, anime, nhạc, manga, từ điển, bạn tự thêm) kèm tên, vị trí (trang/phút/track) và ghi chú. Trong file bài học, thêm `"source": {"type": "anime", "title": "One Piece", "location": "12:31", "note": "..."}` vào mục; không ghi thì lấy nguồn của cả bài.
- **Âm thanh**: không kèm file. Mỗi nút nghe dùng file âm thanh bạn *gắn* (từ CD sách của bạn, lưu trong máy), nếu chưa gắn thì dùng giọng đọc tiếng Nhật có sẵn của thiết bị.
- Nguồn mở có thể dùng thêm sau này: Tatoeba (câu ví dụ), JMdict/KANJIDIC (từ, kanji), có ghi giấy phép trong gói.

## Cho người muốn chạy thử trên máy (tuỳ chọn)

Cần cài [Node.js 22](https://nodejs.org). Rồi:

```bash
npm install
npm run dev      # mở http://localhost:5173
npm test         # chạy kiểm tra tự động
npm run build    # tạo bản web trong thư mục dist/
```

Bản Windows cần thêm [Rust](https://rustup.rs): `npm run tauri build`. Thông thường bạn không cần làm vậy, GitHub tự build giúp.

## Ôn tập thẻ (SRS) hoạt động thế nào
- Thẻ nào bạn **quên** sẽ quay lại sau ~10 phút (và ngay trong phiên ôn, sau 3 thẻ). Thẻ bạn nhớ rõ sẽ được hẹn **ngày càng xa**: 3 ngày, rồi 1-2 tuần, rồi vài tháng. Việc tính lịch dùng thuật toán mở **FSRS**.
- Sau mỗi thẻ bạn bấm **Quên / Khó / Tốt / Dễ**. Trên nút có ghi bao lâu nữa thẻ sẽ quay lại.
- 4 dạng câu hỏi: nhìn cách đọc chọn nghĩa; nghe rồi chọn chữ Hán; viết tay chữ Hán; điền từ vào chỗ trống. Có thể tắt bớt trong *Cài đặt ôn tập*.
- Viết tay: app **không tự chấm** chữ bạn viết. Bạn viết, bấm *Xem đáp án*, tự so và chọn mức nhớ cho trung thực.
- **Hoàn tác** hiện trong 6 giây sau mỗi thao tác (chấm thẻ hoặc "Để sau").
- **Ôn nhanh 5 phút**: phiên có đồng hồ đếm ngược, hết giờ thì dừng, thẻ còn lại để mai.
- Tiến độ lưu ngay trên máy (offline), tách khỏi gói nội dung nên cập nhật hay gỡ gói thẻ **không làm mất tiến độ**.
- Muốn thêm thẻ: làm một gói như `packs-src/demo-cards/v1.json` (mỗi thẻ có `word`, `reading`, `meaning`, và tuỳ chọn `example` để có câu điền chỗ trống).
- Nghe phát âm dùng giọng đọc có sẵn của máy; nếu máy chưa có giọng tiếng Nhật thì tắt dạng "Nghe" trong cài đặt.

## Tình trạng

Đây là **bộ khung**: giao diện, màu sáng/tối, furigana, kho dữ liệu offline, định dạng gói nội dung, và quy trình build tự động. Các tính năng (SRS, từ điển, kana/kanji, manga, anime, tiến độ) sẽ được làm ở các nhánh riêng, dựa trên bộ khung này.


## Cộng đồng (nhóm học, thử thách, xếp hạng)
Tuỳ chọn, tắt mặc định, chạy offline bằng file xuất/nhập. Xem [docs/CONG-DONG.md](docs/CONG-DONG.md), có cả phần "muốn có máy chủ thật thì cần gì".

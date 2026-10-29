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

**Về bản quyền:** app *không* kèm sẵn manga, anime hay giáo trình có bản quyền. Bạn tự nạp file của mình. Gói nội dung chỉ dùng dữ liệu mở (JMdict, KANJIDIC, Jitendex...), luôn ghi rõ giấy phép.

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

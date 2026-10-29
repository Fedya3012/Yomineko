# Hướng dẫn: Tổng kết học tập, điểm yếu và độ khó thích ứng

Dành cho người không biết code. Mở app, kéo xuống mục **Tiến độ học**, bên dưới là ba thẻ mới.

## 1. Tổng kết học tập
- Chọn **Ngày / Tuần / Tháng**, bấm mũi tên ← → để xem kỳ trước hoặc kỳ sau. Tuần tính từ thứ Hai đến Chủ nhật.
- Bạn thấy: thời gian học, tỉ lệ đúng, số từ / kanji / ngữ pháp đã chạm tới, kết quả ôn SRS (quên, khó, tốt, dễ), nội dung chính, điểm mạnh, điểm yếu và **gợi ý cho buổi sau**.
- **Sao chép**: chép bản tổng kết để dán vào tin nhắn. **Xuất Markdown**: tải file `.md`.
- **Phong cách viết**: Chuẩn, Vui vẻ, Nghiêm khắc, Ngắn gọn, Nhật ký của Mochi. Bấm **Viết lại (offline)** để đổi giọng ngay trên máy, không cần mạng.

## 2. AI là tuỳ chọn
- Mọi thứ trên đều chạy **không cần AI, không cần mạng**.
- Nút **Viết lại bằng AI** chỉ bấm được khi bạn đã bật AI **và** đồng ý gửi dữ liệu ở mục **Trợ lý AI** (xem `docs/AI-TRO-LY.md`).
- Bấm **Xem nội dung sẽ gửi cho AI** để biết chính xác điều gì rời khỏi máy. Chỉ có bản tổng kết (con số và vài nhãn từ), **không** gửi lịch sử học thô. Không đồng ý thì không có gì được gửi.
- Nếu AI lỗi hoặc mất mạng, app tự dùng bản offline và báo cho bạn.

## 3. Điểm yếu hay gặp
- Mochi nhìn 30 ngày gần nhất, nhóm lỗi thành: **trợ từ**, **chia động từ**, **âm On**, **âm Kun**, kanji, từ vựng, ngữ pháp. Lỗi gần đây được tính nặng hơn lỗi cũ.
- Từ nào sai **từ 2 lần trở lên** và sai ít nhất 1/3 số lần gặp sẽ được **hỏi trước** trong Ôn tập thẻ (SRS).
- Lưu ý: app đoán nhóm lỗi từ nhãn của thẻ (ví dụ "は (chủ đề)" là trợ từ). Những tính năng học mới có thể ghi nhóm chính xác bằng trường `tag`.

## 4. Độ khó thích ứng
- Dựa trên 7 ngày gần nhất (cần ít nhất 20 lượt trả lời, nếu không thì giữ nguyên).
- Đúng từ 92% và ít quên: gợi ý **tăng** 2 thẻ mới/ngày. Đúng dưới 70% hoặc quên nhiều: **giảm** 3 thẻ mới/ngày và tăng mức nhớ thêm 2%. Giới hạn: 3 đến 30 thẻ mới/ngày, mức nhớ 80% đến 95%.
- Bấm **Áp dụng gợi ý** để đổi. Ô **Tự động chỉnh mỗi ngày** mặc định **tắt**; bật thì app tự áp dụng tối đa một lần mỗi ngày.

## Dữ liệu được lưu ở đâu
Chỉ trên máy bạn (khoá `insights.settings`, cùng dữ liệu tiến độ và SRS đã có). Gỡ gói nội dung không làm mất gì.

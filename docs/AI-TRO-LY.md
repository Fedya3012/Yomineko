# Hướng dẫn trợ lý AI (dành cho người không biết code)

## Trợ lý làm được gì?
- **Trò chuyện**: chào hỏi, khích lệ bạn.
- **Giải thích ngữ pháp**: gõ từ khoá như `は`, `ます`, `て形`, `たい`.
- **Sửa câu**: gõ một câu tiếng Nhật, trợ lý chỉ ra lỗi và đưa câu đã sửa.
- **Nhập vai**: luyện nói theo tình huống thật (cửa hàng tiện lợi, nhà hàng, tự giới thiệu, hỏi đường).

## Chọn nhân vật
Vào **Trợ lý → Cài đặt**. Có 4 thú cưng (Mochi, Kon, Shiba, Usagi) và 3 nhân vật anime (Sakura, Haruto, Tanaka-sensei). Bạn có thể đặt tên riêng, chọn tính cách (dịu dàng, năng động, nghiêm khắc nhưng thương) và trình độ N5 đến N1. Tất cả nhân vật là sáng tác riêng, không dùng nhân vật có bản quyền.

## Chế độ offline (mặc định)
Không cần mạng, không cần tài khoản, không tốn tiền. Trợ lý dùng nội dung viết sẵn:
- ~16 bài ngữ pháp cơ bản;
- kiểm tra các lỗi hay gặp (nhầm を/が, thêm です sau động từ, thừa い/な...);
- 4 tình huống nhập vai có gợi ý và câu mẫu. Offline chỉ **"chấm đơn giản"**: so câu bạn nói với câu mẫu (cần giống đủ nhiều, nói mỗi từ "はい" là chưa đạt). Nó không hiểu ngữ pháp thật; bật AI để được nhận xét kỹ hơn.

Chế độ này **không thông minh bằng AI** (không hiểu mọi câu), nhưng luôn dùng được.

## Bật AI (tuỳ chọn)
AI **tắt** khi cài mới. Khi tắt, không có gì rời khỏi máy bạn. Muốn bật:
1. **Cài đặt → tích "Dùng AI"**.
2. Chọn một trong ba cách:
   - **Máy của bạn (Ollama), miễn phí và riêng tư nhất**: cài [Ollama](https://ollama.com), mở ứng dụng, chạy lệnh `ollama pull qwen2.5:3b` một lần. Nếu dùng bản web (PWA) và bị chặn, đặt biến `OLLAMA_ORIGINS=*` rồi khởi động lại Ollama. Không cần khoá API.
   - **Claude**: lấy khoá API ở console.anthropic.com, dán vào ô "Khoá API". Mô hình mặc định `claude-haiku-5-5` (nhẹ, rẻ).
   - **Dịch vụ tương thích OpenAI** (OpenAI, Groq, OpenRouter...): chọn mục này, sửa "Địa chỉ" và "Tên mô hình" theo nhà cung cấp, dán khoá API.
3. Đọc ô vàng và **tích đồng ý**. Chưa tích thì ứng dụng không gửi gì.

## Quyền riêng tư
- Chỉ gửi tới địa chỉ bạn đã đồng ý, gồm: tối đa 8 tin nhắn gần nhất, trình độ, tên và tính cách nhân vật.
- Không bao giờ gửi: thẻ SRS, tiến độ học, thư viện manga/anime.
- Đổi địa chỉ hoặc dịch vụ thì sự đồng ý bị huỷ, phải tích lại.
- Khoá API và lịch sử chat chỉ lưu trong bộ nhớ của ứng dụng trên máy bạn (không đưa lên GitHub, không đồng bộ). Nút **"Xoá hết dữ liệu trợ lý"** xoá sạch.
- Mất mạng, hết tiền, sai khoá, máy chủ lỗi: ứng dụng tự quay về chế độ offline và báo lý do.

## Dành cho người sửa app sau này
- Mã nằm trong `src/features/assistant/`. Nhân vật: `personas.ts`; bài ngữ pháp và luật sửa lỗi: `offline-data.ts`; tình huống nhập vai: `scenarios.ts`. Thêm nội dung chỉ cần thêm một dòng vào các file này.
- Kiểm tra: `npm run check && npm test && npm run build`.
- Khi nhập vai kết thúc, trợ lý báo cho thread Tiến độ qua `onSessionEnd` (cùng dạng `SessionInput` của `recordSession`). Đã nối sẵn với `recordSession` trong `App.svelte`.

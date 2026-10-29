# Cộng đồng: hướng dẫn cho người không code

## Cộng đồng làm được gì?
- **Nhóm học**: tạo nhóm, mời bạn bè.
- **Thử thách** theo tuần hoặc tháng (tính phút học, số thẻ, mục mới học, số ngày có học).
- **Bảng xếp hạng** của nhóm.
- **Bảng tin**: chia sẻ chuỗi ngày, tiến độ hôm nay, từ mới tuần này, hoặc viết vài dòng.

## Quy tắc quan trọng: mặc định không chia sẻ gì
Cộng đồng **tắt** cho đến khi bạn bấm “Bật cộng đồng”. Ngay cả khi bật, app không tự gửi gì cả. Số liệu chỉ rời máy khi bạn bấm **Tải file chia sẻ** hoặc **Sao chép mã**, và chỉ gồm những mục bạn đã tick trong “Bạn muốn chia sẻ gì?”. Muốn thôi: bấm “Xoá dữ liệu cộng đồng”.

## Dùng thử một mình
Ở màn hình đầu bấm **Xem thử với dữ liệu mẫu**. App tạo “Nhóm Sakura (mẫu)” với bốn bạn giả. Dữ liệu mẫu không bao giờ bị xuất ra, xoá bằng nút “Xoá dữ liệu mẫu”.

## Rủ bạn bè (vì app chưa có máy chủ)
1. Bạn: Cộng đồng → Nhóm → tạo nhóm → tick số liệu muốn chia sẻ → “Tải file chia sẻ”.
2. Gửi file qua Zalo, Messenger hoặc email (hoặc “Sao chép mã” rồi dán vào tin nhắn).
3. Bạn bè: Cộng đồng → Nhóm → “Nhận từ bạn bè” → chọn file hoặc dán mã → Nhập. Họ vào nhóm và thấy số liệu, thử thách, bảng tin của bạn.
4. Muốn cập nhật bảng xếp hạng: ai cũng xuất file mới và gửi lại, mọi người nhập lại. Nhập nhiều lần không bị trùng, số mới thay số cũ.
5. Nhóm đông người: file của một người kèm số liệu mới nhất người đó biết về các thành viên khác, nên chỉ cần chuyền file vòng quanh.

App từ chối file lạ, file hỏng hoặc từ phiên bản mới hơn và nói rõ lý do bằng tiếng Việt. Mọi chữ trong file đều bị cắt ngắn và làm sạch.

## Màn hình
Ảnh sáng/tối: `docs/design/cong-dong-*.png` (nhóm, thử thách, xếp hạng, bảng tin).

## Dành cho người làm kỹ thuật
Mã ở `src/features/community/`. Khoá `userdata`: `community.profile`, `community.group:<id>`, `community.challenge:<id>`, `community.person:<id>`, `community.post:<id>`. Định dạng file: `share.ts` (`format: "yomineko-community"`, `version: 1`).

### Muốn có cộng đồng thật (máy chủ) thì cần gì?
- Tài khoản và đăng nhập (email hoặc Google), chống spam.
- Cơ sở dữ liệu nhóm, thành viên, thử thách, bài đăng; API đồng bộ thay cho file (có thể dùng lại đúng định dạng này làm nội dung gửi lên).
- Kiểm tra số liệu phía máy chủ (hiện ai cũng tự khai được số phút), quyền riêng tư, xoá tài khoản.
- Báo cáo/chặn người dùng và kiểm duyệt bài đăng, nhất là với người nhỏ tuổi.
- Thông báo đẩy khi có thử thách mới; chi phí vận hành; chính sách quyền riêng tư.

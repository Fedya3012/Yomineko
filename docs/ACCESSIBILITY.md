# Trợ năng (accessibility) của Yomineko

Mục tiêu: **WCAG 2.2 mức AA**. Mọi thread tính năng phải giữ đúng các quy tắc dưới đây.

## Tương phản (đã tính bằng công thức WCAG)
| Cặp màu | Sáng | Tối | Ngưỡng |
|---|---|---|---|
| Chữ chính / nền | 10,7 | 14,4 | 4,5 |
| Chữ phụ `--text-muted` / mọi bề mặt | ≥ 5,7 | ≥ 5,8 | 4,5 |
| Chữ trên nút hồng (`--on-accent`) | 5,9 | 7,5 | 4,5 |
| `--accent-strong` trên nền hồng nhạt | 5,5 | 7,1 | 4,5 |
| Chip mint / lavender / butter / sky | ≥ 4,6 | ≥ 6,1 | 4,5 |
| Viền ô nhập, công tắc (`--border-strong`) | ≥ 3,0 | ≥ 3,5 | 3,0 |
| Vòng/thanh tiến độ (`--accent-gfx`) | ≥ 3,0 | ≥ 6,7 | 3,0 |

Đã sửa so với bản đầu: chữ trắng trên nút hồng chỉ đạt 2,7 nên đổi sang chữ mận đậm; chữ phụ, chữ xanh lá, viền ô nhập đều được làm đậm hơn. `--border` (nhạt) chỉ dùng để trang trí, **không** dùng làm viền của thứ bấm được.
Chế độ **Tương phản cao** (`data-contrast="high"`) đẩy chữ lên đen/trắng thuần và viền đậm.

## Quy tắc cho mọi component
1. **Bàn phím**: mọi thứ bấm được phải focus được và dùng được bằng Tab / Enter / Space. Nhóm radio và tab dùng mũi tên (roving tabindex), xem `Segmented.svelte`.
2. **Focus nhìn thấy**: vòng hai lớp `--focus` (viền nền + viền tím) trên mọi nền, không bao giờ `outline: none` mà không thay thế.
3. **Màn hình đọc**: nút chỉ có icon phải có `aria-label` tiếng Việt; chữ Nhật gắn `lang="ja"`; trạng thái lỗi dùng `role="alert"`, đang tải dùng `role="status"` + `aria-busy`; thao tác không đổi giao diện (thêm thẻ, chấm thẻ) báo qua `Announcer`.
4. **Không chỉ dùng màu**: mức thuộc kana có ký hiệu ● ◑ ◔ ○; lỗi có dấu "!"; lịch học có dấu ✓.
5. **Chữ co giãn**: dùng `--text-*`; cỡ chữ 100–200% (`fontScale`), bố cục xuống dòng thay vì tràn (đã thử 200% trên điện thoại 400 px).
6. **Vùng bấm ≥ 44 px**.
7. **Giảm chuyển động**: tôn trọng `prefers-reduced-motion` và công tắc `data-motion="reduce"`.
8. **Màn hình Windows tương phản cao** (`forced-colors`): nút, thẻ, chip có viền hệ thống.
9. **Bỏ qua điều hướng**: `SkipLink` là phần tử đầu tiên; khi đổi màn hình, đưa focus vào tiêu đề h1.
10. Mọi màn hình dữ liệu phải thiết kế đủ 3 trạng thái: **trống** (nói rõ sẽ có gì và làm gì tiếp), **đang tải**, **lỗi** (nói gì xảy ra, làm gì, có nút Thử lại).

## Kiểm tra trước khi mở PR cho thread tính năng
- Tab qua cả màn hình mà không cần chuột.
- Phóng chữ 200%: không tràn ngang, không mất chữ.
- Bật Tương phản cao và Tối: chữ vẫn đọc rõ.
- Mở với trình đọc màn hình (NVDA / TalkBack): nghe được tên mọi nút.

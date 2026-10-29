# Kiến trúc Yomineko (dành cho các thread tính năng)

## Một codebase, ba vỏ
- `src/`: ứng dụng Svelte 5 + Vite + TypeScript. Đây là nơi **toàn bộ** tính năng được viết.
- `src-tauri/`: vỏ Windows (Tauri 2). Chỉ thêm Rust khi cần khả năng gốc (chọn file, v.v.).
- `capacitor.config.ts`: vỏ Android. Thư mục `android/` được CI tạo ra, không commit.
- PWA: `vite-plugin-pwa` cache toàn bộ app để chạy offline.
- `base: './'` (đường dẫn tương đối) để cùng một bản build chạy được trong cả ba vỏ. Riêng GitHub Pages dùng biến `BASE_PATH`.

## Thiết kế giao diện
- Mọi màu, cỡ chữ, bo góc nằm trong `src/styles/tokens.css`. **Không** viết mã màu cứng trong component; dùng `var(--accent)`, `var(--surface)`, v.v.
- Dark mode là bộ token thiết kế riêng (`:root[data-theme="dark"]`), không phải đảo màu.
- Furigana: dùng thẻ `<ruby>漢字<rt>かんじ</rt></ruby>`; công tắc toàn cục ẩn `<rt>`. Chữ Nhật gắn `lang="ja"` hoặc class `jp`. Chữ dọc: class `vertical`.
- Cỡ chữ dùng `--text-*` (đã nhân `--font-scale` cho chế độ chữ lớn). Nút tối thiểu cao 44px.
- Cài đặt hiển thị: `src/lib/settings.ts`.

## Dữ liệu offline (`src/lib/db.ts`)
IndexedDB, ba kho tách bạch:
| Kho | Chứa | Ai ghi |
|---|---|---|
| `packs` | gói nội dung đã cài (id, version, license) | trình cài gói |
| `records` | nội dung, khoá `[collection, id]`, gắn `packId` | **chỉ** trình cài gói |
| `userdata` | dữ liệu người học (SRS, tiến độ, lịch sử) | các thread tính năng |

Quy tắc: **nội dung vào `records` qua gói; dữ liệu của người học vào `userdata`**. Nhờ vậy cập nhật hay gỡ gói không bao giờ làm mất tiến độ.
Đọc: `listCollection(db, 'words')`, `getRecord(...)`, `getUserData(...)`, `setUserData(...)`.
Đổi cấu trúc DB: tăng `DB_VERSION` và thêm khối `if (oldVersion < N)`, không sửa khối cũ.

## Gói nội dung (`src/lib/packs/`)
- `format.ts`: kiểu dữ liệu + `validatePack`. Một gói là một file JSON: `manifest` (id, kind, version, license, `base` nếu là gói delta) + `upserts` / `deletes` theo *collection*.
- `install.ts`: `installPack` (một transaction, được-ăn-cả-ngã-về-không), `uninstallPack`, `planUpdates(catalog)`, `downloadAndInstall` (kiểm tra SHA-256).
- Gói đầy đủ thay toàn bộ nội dung cũ của gói; gói delta chỉ áp dụng khi máy đang đúng phiên bản `base`.
- `npm run catalog` tạo `catalog.json` (danh sách gói + mã kiểm tra) từ thư mục `packs-example/`. Mẫu: `packs-example/demo-hiragana.pack.json`.
- Mọi gói **bắt buộc** khai báo license; màn hình Credits (thread sau) sẽ liệt kê `attribution`.

## Tên collection mỗi thread sở hữu (đề xuất)
| Thread | Collection (content) | Khoá userdata |
|---|---|---|
| Từ điển | `words` (JMdict), `examples` | `dict.history` |
| Kana/Kanji | `kana`, `kanji` (KANJIDIC) | `kanji.known` |
| SRS | `cards`, `decks` | `srs.state:<cardId>`, `srs.settings` |
| Tiến độ | `lessons` | `progress.*` |
| Manga / Anime | không bán nội dung; người dùng nạp file | `library.*`, `reader.position:<id>` |

## Quy ước
- Giao diện tiếng Việt (có thể thêm i18n sau); chữ Nhật luôn có `lang="ja"`.
- Mỗi tính năng: component trong `src/features/<tên>/`, test `*.test.ts` cạnh file.
- Trước khi mở PR: `npm run check && npm test && npm run build` (CI chạy lại đúng ba lệnh này).

## Phong cách minh hoạ & icon (theo ảnh tham khảo của Fedya)
Huy hiệu tròn kiểu "sticker": viền lượn sóng vẽ tay, nét viền đậm, màu phẳng, chủ đề Nhật (torii, sushi, mèo may mắn, cá koinobori...).
- Component `src/lib/Badge.svelte` vẽ khung tròn lượn sóng (`tone`: coral, teal, mint, sky) quanh icon SVG nét đơn (`stroke: currentColor`).
- Màu minh hoạ nằm trong `tokens.css` (`--badge-*`, `--ink`), tách khỏi màu giao diện để nút vẫn mềm màu hồng.
- Icon mới: SVG viewBox 100x100, nét 3.5, bo tròn đầu nét, không tô màu; để Badge lo khung.
- Mochi (mèo trắng) theo kiểu mèo may mắn: mắt tròn to, má hồng.

## Màu & cảm giác chung (tham khảo thêm)
Giữ hồng sakura, kem và tối tím than. Thêm pastel vàng bơ (`--butter-*`) và xanh trời (`--sky-*`) làm điểm nhấn; thẻ `.chip` có thêm biến thể `butter|sky|mint|pink`. Hình khối mềm hữu cơ (`.blob`) làm nền minh hoạ, góc bo lớn, nhiều khoảng trắng, chữ Nhật dùng font tròn (Zen Maru Gothic, nếu máy có). Thông tin dày (danh sách nhiệm vụ, tiến độ) dùng thẻ phẳng viền mảnh, số lớn kiểu "001/010".

## Trợ lý AI (`src/features/assistant/`)
- `userdata` keys: `assistant.settings`, `assistant.apikey`, `assistant.history`. AI **tắt mặc định**; gửi dữ liệu cần `consent` gắn đúng host (`hasConsent`). Mọi gọi mạng đi qua `respond()` trong `assistant.ts`, nơi tự lùi về `offline.ts` khi thiếu đồng ý, khoá, mạng hoặc khi lỗi.
- Báo cáo buổi nhập vai: `onSessionEnd` (xem `report.ts`), đã nối với `recordSession` trong `App.svelte`. Hướng dẫn người dùng: `docs/AI-TRO-LY.md`.

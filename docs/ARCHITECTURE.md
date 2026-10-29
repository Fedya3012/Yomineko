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
- Nguồn gói nằm ở `packs-src/<id>/v1.json, v2.json...` (mỗi file là bản ĐẦY ĐỦ). `npm run packs:build` (`scripts/packs-lib.ts`) tạo ra bản đầy đủ mới nhất, gói delta cho mỗi cặp phiên bản liền kề và `catalog.json` (SHA-256, size, `minAppVersion`). Pages workflow đăng tại `<site>/content/`. Hướng dẫn cho người không code: `docs/HUONG-DAN-XUAT-BAN-GOI.md`.
- `install.ts` → `planUpdates(db, catalog, appVersion)` chọn cách rẻ nhất cho từng gói: chuỗi delta liên tiếp nếu nhỏ hơn gói đầy đủ, nếu không thì gói đầy đủ; không bao giờ hạ cấp; bỏ qua gói cần app mới hơn.
- `updater.ts`: `checkContentUpdates` (chỉ tải catalog nhỏ) và `applyUpdates` (từng gói độc lập; delta hỏng thì thử gói đầy đủ; sai checksum thì giữ bản cũ). Chỉ chấp nhận https.
- Mọi gói **bắt buộc** khai báo license; màn hình Credits (thread sau) sẽ liệt kê `attribution`.

## Thông báo bản mới (`src/features/updates/UpdateCenter.svelte`)
- Nội dung: kiểm tra tự động tối đa 12 giờ/lần khi có mạng, hoặc bấm *Kiểm tra cập nhật*.
- App: Windows/Android hỏi GitHub Releases (`src/lib/appUpdate.ts`); web dùng service worker (`registerType: 'prompt'`, hiện nút tải lại). Phiên bản app = `package.json`, workflow release ghi đè bằng tên tag (`scripts/set-version.mjs`).
- Địa chỉ catalog: `CATALOG_URL` trong `src/lib/appInfo.ts` (đổi bằng biến `VITE_CATALOG_URL`).

## Tên collection mỗi thread sở hữu (đề xuất)
| Thread | Collection (content) | Khoá userdata |
|---|---|---|
| Từ điển | `words` (JMdict), `examples` | `dict.history` |
| Kana/Kanji | `kana`, `kanji` (KANJIDIC) | `kanji.known` |
| SRS | `cards` (`decks` chưa dùng) | `srs.state:<cardId>`, `srs.settings`, `srs.stats:<YYYY-MM-DD>` (số lượt ôn mỗi ngày, thread Tiến độ có thể đọc) |
| Tiến độ | (không có) | `progress.*` |
| Giáo trình | `textbooks`, `tb-lessons` | `textbook.*` (xem mục Giáo trình) |
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

## UI dùng chung & trợ năng (thread UI/UX)
- Thành phần: `src/lib/ui/` (Button, Toggle, Segmented, Slider, ProgressRing/Bar, KeyCap, Mochi, NavBar, JpText, EmptyState, ErrorState, Skeleton, SkipLink, Announcer). Import từ `src/lib/ui`. Xem thử: mở app với `?gallery`.
- 15 màn hình thiết kế (sáng/tối, trống/tải/lỗi): `docs/design/screens.html` (mở bằng trình duyệt).
- Quy tắc trợ năng bắt buộc cho mọi thread: `docs/ACCESSIBILITY.md`. Viền của thứ bấm được dùng `--border-strong`, màu vẽ dùng `--accent-gfx`.

## Từ điển (`src/features/dictionary/`)
- Dữ liệu: collection `words` (JMdict), `examples` (Tatoeba), `kanji` (KANJIDIC2). Kiểu dữ liệu ở `types.ts`.
- Gói thật được tạo bằng `scripts/build-dict-pack.mjs` (hoặc workflow **Dictionary packs** trên GitHub Actions) từ dữ liệu mở của dự án jmdict-simplified + danh sách JLPT; gói mẫu CC0 để thử: `packs-src/dict-sample/v1.json`.
- Tìm kiếm: `DictionaryIndex` (trong bộ nhớ, dựng từ `words`) tìm theo chữ Hán, kana, romaji và nghĩa tiếng Anh. `loadDictionary(db)` dựng lại index sau khi cài/gỡ gói.
- Chạm từ: `lookupAt(index, text, pos)` tìm từ dài nhất tại vị trí đó, có xử lý chia động từ/tính từ -i. `LookupText.svelte` dùng được ở mọi nơi có chữ Nhật (manga, phụ đề, bài học): chạm là mở popup (`WordPopup.svelte`, gắn một lần trong `App.svelte`). Mã khác có thể gọi `openWord(id)`.
- Tìm kiếm chung: `searchAll(query)` gộp từ điển + thẻ/ghi chú của người học. Thread khác gắn nguồn của mình bằng `registerSearchSource`. Nguồn có sẵn đọc userdata `card:<id>` / `note:<id>` (trường `front`, `back`, `reading`, `title`, `text`, `tags`) và collection `cards`.
- Giấy phép: `licenses.ts` là danh sách hiển thị trong app. **Thêm nguồn dữ liệu mới thì phải thêm vào đây.**


## Trình đọc manga + OCR (`src/features/manga/`)
Người dùng tự nạp truyện (CBZ, CBR, PDF, thư mục ảnh, nhiều ảnh); app **không** kèm truyện nào và không tải file đi đâu.
- `open.ts` nhận file, đoán định dạng theo **byte đầu** (`formats.ts`, vì nhiều file `.cbr` thực ra là ZIP), rồi gọi `sources/{cbz,cbr,pdf,folder}.ts`. Mỗi nguồn trả về danh sách `PageRef` (chỉ giải nén/vẽ trang khi cần). `pageCache.ts` chỉ giữ vài trang quanh trang đang đọc.
- `spreads.ts` (1 trang / 2 trang, bìa riêng, trang ngang đứng riêng, chiều đọc phải→trái hoặc trái→phải), `zoom.ts` + `spreadMath.ts` (zoom, kéo, chạm đúp, pinch; đổi toạ độ màn hình → toạ độ trang). Toàn bộ là hàm thuần, có test.
- OCR (`ocr/`): `engine.ts` chạy Tesseract.js trong Web Worker, **offline**. Chạy 2 model (`jpn` ngang, `jpn_vert` dọc), `normalize.ts` lọc nhiễu, nhận kiểu chữ theo hình dạng dòng, ghép kết quả và sắp thứ tự đọc manga (trên→dưới, phải→trái). Có thể quét cả trang hoặc chỉ một vùng người dùng kéo chọn (chính xác hơn).
  - Ô của từng chữ được chia đều theo ô của **dòng**, vì ô theo từng ký tự của tesseract.js không đáng tin với chữ Nhật (chữ dọc trả về x = 0).
- Tra nghĩa (`lookup.ts`): chạm chữ → `hit.ts` tìm ký tự → khớp từ dài nhất trong collection `words` (gói từ điển, xem bảng trên). Chưa có gói từ điển thì app báo rõ. **Thread Từ điển**: khi đổi cấu trúc bản ghi `words`, sửa `WordEntry`/`buildWordIndex` ở đây; chưa có tách đuôi động từ/tính từ (ví dụ 読んだ → 読む), nên là việc nên làm.
- Vị trí đọc + tuỳ chọn hiển thị lưu ở `userdata` (`reader.position:<id>`, `reader.prefs`).
- `scripts/copy-vendor-assets.mjs` (chạy tự động trước `dev`/`build`) chép engine OCR, model tiếng Nhật và bộ đọc RAR vào `public/ocr`, `public/vendor` (git bỏ qua). PWA chỉ cache chúng lần đầu dùng (khoảng 20 MB), bản .exe/APK thì có sẵn.

### Giấy phép thành phần dùng cho manga/OCR (đều cho phép dùng thương mại)
| Thành phần | Giấy phép | Dùng để |
|---|---|---|
| tesseract.js + tesseract.js-core | Apache-2.0 | OCR chạy trên máy |
| Model Tesseract `jpn`, `jpn_vert` (gói `@tesseract.js-data/*`, bản best_int) | Apache-2.0 (dữ liệu Tesseract) | nhận dạng chữ Nhật ngang/dọc |
| pdfjs-dist | Apache-2.0 | mở PDF |
| libarchive.js (bọc libarchive) | MIT (libarchive: BSD-2) | mở CBR/RAR/7z |
| fflate | MIT | mở CBZ/ZIP |
Màn hình Credits (thread sau) nên liệt kê các dòng này.
## Trợ lý AI (`src/features/assistant/`)
- `userdata` keys: `assistant.settings`, `assistant.apikey`, `assistant.history`. AI **tắt mặc định**; gửi dữ liệu cần `consent` gắn đúng host (`hasConsent`). Mọi gọi mạng đi qua `respond()` trong `assistant.ts`, nơi tự lùi về `offline.ts` khi thiếu đồng ý, khoá, mạng hoặc khi lỗi.
- Báo cáo buổi nhập vai: `onSessionEnd` (xem `report.ts`), đã nối với `recordSession` trong `App.svelte`. Hướng dẫn người dùng: `docs/AI-TRO-LY.md`.

## Trình phát anime (`src/features/anime/`)
- `subtitles.ts` đọc SRT/VTT/ASS; `tokenizer.ts` + `deinflect.ts` tách từ (khớp từ điển dài nhất, có đưa động từ/tính từ về dạng gốc, dự phòng `Intl.Segmenter`).
- Từ điển đọc từ collection `words` (`kanji`, `reading`, `meaning`, `id`): khi thread Từ điển nạp JMdict, trình phát tự dùng.
- `comprehension.ts`: Điểm hiểu = % từ (không tính dấu câu, trợ từ 1 chữ) nằm trong tập "đã biết".
- Userdata: `anime.known` (khoá từ đã biết), `anime.cards` (thẻ tạo từ phụ đề: word, reading, meaning, sentence) — **thread SRS đọc `anime.cards` để đưa vào ôn tập**; `anime.position:<tên>:<kích thước>` (vị trí xem dở).
- `shadowing.ts` (toán thuần, có test) + `audio.ts` (micro, thu âm mẫu, nhận giọng nói; chỉ chạy trong trình duyệt).

## Lộ trình & onboarding (`src/features/roadmap/`)
- Lần mở đầu tiên app hỏi 6 câu (trình độ, mục tiêu, phút/ngày, nội dung yêu thích, điểm yếu, kiểu học); có nút bỏ qua. Câu trả lời + đồng hồ + dữ liệu học thật sinh ra lộ trình bằng `generateRoadmap` (hàm thuần, theo luật, **chạy offline**, cùng đầu vào cho cùng kết quả).
- AI chỉ là phần tuỳ chọn (`ai.ts`): viết lại lời tóm tắt và lời khuyên, **không đổi lịch**. Dùng chung cổng riêng tư của trợ lý (tắt mặc định, cần đồng ý đúng host); lỗi hoặc không mạng thì giữ bản theo luật.
- userdata: `roadmap.answers`, `roadmap.plan`, `roadmap.skipped`, `roadmap.ticks:<ngày>`.
- Nối với nơi khác: đọc `srs.stats`, `progress.*` (tiến độ giai đoạn, mục tiêu tuần, tự tick buổi SRS), collection `tb-lessons` + `textbooks` (đọc qua `loadLessons`; có thì nhiệm vụ "bài giáo trình" trỏ tới bài thật). Chỉ **ghi** `srs.settings` / `progress.settings` khi người học bấm "Áp dụng".
- Nhiệm vụ mở màn hình qua `LinkTarget`; `openTarget` trong `App.svelte` xử lý. Kanji → Kana & Kanji, manga → trình đọc, bài học → Giáo trình.

## Tổng kết & AI nâng cao (`src/features/insights/`)
- `summary.ts`: tổng kết theo ngày/tuần/tháng từ `progress.day:*`, `progress.learned`, `srs.stats:*`; xuất text/Markdown. `weakness.ts`: phân loại lỗi (trợ từ, chia động từ, On/Kun, ...) bằng nhãn hoặc `tag` tuỳ chọn trong `StudiedItem`; điểm giảm một nửa sau 7 ngày. `adaptive.ts`: gợi ý độ khó từ 7 ngày gần nhất. Tất cả là hàm thuần, chạy offline.
- `rewrite.ts`: viết lại tổng kết theo phong cách. Bản offline dùng mẫu câu; bản AI đi qua `aiBlockedReason` của trợ lý nên cần đúng sự đồng ý theo host, và chỉ gửi văn bản tổng kết (`aiPayload`).
- SRS: `buildQueue` nhận `boost` (cardId → điểm yếu) để hỏi từ sai lặp lại trước; `SrsReview` lấy từ `loadBoost`.
- Userdata: `insights.settings` (`adaptiveAuto` mặc định tắt, `lastAuto`). Hướng dẫn: `docs/HUONG-DAN-TONG-KET-AI.md`.

## Giáo trình (`src/features/textbook/`)
- Nội dung vào `records` qua gói `kind: "lesson"`; định dạng bài ở `types.ts`. Sách có sẵn chỉ là khung (`scripts/make-textbook-packs.mjs`), không có chữ của nhà xuất bản.
- **Nối với SRS:** "Đưa vào thẻ ôn" cài một gói cá nhân `tb-srs-<lessonId>` chứa thẻ (từ vựng + kanji) vào collection `cards`, nên SRS dùng được ngay. Id thẻ ổn định (không trùng khi thêm lại); gỡ gói không mất lịch sử ôn (`srs.state:*`). Mẫu ngữ pháp chưa thành thẻ.
- **Nối với Tiến độ:** trả lời bài tập gọi `recordSession` (ở `answerExercise`) với `ref` của câu hỏi.
- **File sách của người học** (`bookfile.ts`, `BookReader.svelte`, `epub.ts`): PDF/EPUB lưu ở `userdata` (`textbook.file:<bookId>`), PDF vẽ bằng pdf.js (tải khi cần), EPUB giải nén bằng fflate và hiển thị trong iframe `sandbox=""`. Liên kết bài↔trang: `bookRef` trong bài (từ gói) hoặc `textbook.bookref:<lessonId>` (người học tự gắn, ưu tiên hơn).

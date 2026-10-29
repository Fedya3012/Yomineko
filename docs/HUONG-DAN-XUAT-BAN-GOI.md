# Hướng dẫn: đăng gói nội dung mới (không cần biết code)

**Gói nội dung** là một file chứa nội dung học (từ vựng, kanji, bài học...). Khi bạn đăng một phiên bản mới, app trên điện thoại, Windows và web sẽ tự báo *"Có gói nội dung mới"* và chỉ tải **phần thay đổi**, không tải lại cả gói. Tiến độ học của người dùng luôn được giữ nguyên.

> Cách dễ nhất: nhắn Claude *"Thêm các từ này vào gói demo-words và đăng bản mới"*. Claude sẽ làm hết các bước dưới đây. Phần còn lại của hướng dẫn dành cho khi bạn muốn tự làm trên trang GitHub.

## Cần biết trước (3 điều)

1. Mọi gói nằm trong thư mục **`packs-src`** của repo. Mỗi gói có một thư mục riêng tên là **id** của gói (ví dụ `demo-words`).
2. Trong thư mục đó, mỗi phiên bản là một file: `v1.json`, `v2.json`, `v3.json`... Mỗi lần ra bản mới, bạn **thêm một file mới**, **không sửa file cũ**. File cũ để máy tính tự so sánh và tạo ra phần chênh lệch nhỏ.
3. Mỗi file là bản **đầy đủ** của gói ở phiên bản đó. Bạn không phải tự tính "thêm gì, xoá gì": hệ thống tự làm.

## A. Ra bản mới cho một gói đã có

1. Vào repo trên GitHub → `packs-src` → thư mục của gói (ví dụ `demo-words`).
2. Bấm file phiên bản mới nhất (ví dụ `v2.json`) → nút **Raw** → chọn hết (Ctrl+A) → sao chép (Ctrl+C).
3. Quay lại thư mục → **Add file → Create new file**. Tên file: số kế tiếp, ví dụ `v3.json`. Dán nội dung vào.
4. Sửa nội dung: thêm, đổi hoặc xoá các dòng từ/kanji. Giữ đúng dấu phẩy và ngoặc như các dòng bên cạnh.
5. Ở đầu file, đổi `"version": 2` thành `"version": 3` (**phải trùng số trong tên file**).
6. Bấm **Commit changes…** → chọn *Create a new branch* → **Propose changes** → **Create pull request**.
7. Chờ vài chục giây. Nếu có dấu ✔ xanh là hợp lệ. Nếu có dấu ✘ đỏ, bấm *Details* để đọc lỗi (xem bảng cuối trang).
8. Bấm **Merge pull request**. Khoảng 2 phút sau gói được đăng. Lần sau người dùng mở app (hoặc bấm *Kiểm tra cập nhật*) sẽ thấy thông báo.

## B. Tạo gói hoàn toàn mới

1. `packs-src` → **Add file → Create new file**. Gõ tên `ten-goi-moi/v1.json` (dấu `/` tự tạo thư mục). Tên thư mục chỉ dùng chữ thường không dấu, số và dấu gạch ngang.
2. Dán mẫu này rồi sửa:

```json
{
  "manifest": {
    "format": 1,
    "id": "ten-goi-moi",
    "kind": "deck",
    "title": "Tên hiển thị của gói",
    "version": 1,
    "license": {
      "name": "CC BY-SA 4.0",
      "url": "https://creativecommons.org/licenses/by-sa/4.0/",
      "attribution": "Nguồn dữ liệu / tác giả cần được ghi công"
    }
  },
  "upserts": {
    "words": [
      { "id": "neko", "kanji": "猫", "reading": "ねこ", "meaning": "con mèo" }
    ]
  }
}
```

3. `id` phải **trùng tên thư mục**. `kind` là một trong: `dictionary`, `kanji`, `kana`, `deck`, `lesson`, `subtitle`, `other`.
4. Làm tiếp từ bước 6 của phần A.

## Quy tắc vàng

- **Giấy phép là bắt buộc.** Gói nào không ghi `license` sẽ bị từ chối. Chỉ dùng dữ liệu mở (JMdict, KANJIDIC, Jitendex...) hoặc nội dung do chính bạn viết.
- **Không đưa nội dung có bản quyền** (manga, anime, giáo trình như Minna no Nihongo, Genki) vào gói.
- Mỗi bản ghi (một từ, một kanji...) cần có `"id"` riêng, không trùng nhau trong cùng một nhóm. Giữ nguyên `id` khi chỉ sửa nội dung để máy hiểu đó là *sửa* chứ không phải *thêm mới*; xoá cả dòng thì hệ thống tự hiểu là *xoá*.
- Nếu gói cần app mới (ví dụ dùng kiểu dữ liệu mới), thêm vào `manifest` dòng `"minAppVersion": "0.2.0"`. App cũ sẽ báo "hãy cập nhật app trước" thay vì cài nhầm.
- Nhầm lẫn thì không sao: nếu một lần cập nhật bị lỗi giữa chừng, app tự giữ bản cũ, rồi thử tải bản đầy đủ. Dữ liệu học không bao giờ bị xoá.

## Các lỗi thường gặp khi kiểm tra tự động

| Thông báo | Cách sửa |
|---|---|
| `"version" trong file là 2, phải là 3 cho khớp tên file` | Sửa số `version` trong file cho trùng số trong tên file. |
| `"id" trong file là "...", phải trùng tên thư mục` | Sửa `id` hoặc đổi tên thư mục cho giống nhau. |
| `Gói phải ghi rõ giấy phép (license)` | Thêm khối `license` như mẫu ở trên. |
| `Mỗi bản ghi trong ... cần có id dạng chữ` | Có một dòng thiếu `"id": "..."` (giá trị phải đặt trong dấu nháy kép). |
| `file nguồn phải là gói ĐẦY ĐỦ` | Xoá `base` và `deletes` khỏi file; gói cập nhật do máy tự tạo. |
| Lỗi dạng `Unexpected token` hoặc `JSON` | Thừa hoặc thiếu dấu phẩy, ngoặc, hoặc dấu nháy. Dán nội dung vào [jsonlint.com](https://jsonlint.com) để thấy dòng lỗi. |

## Đăng bản app mới (.exe / .apk) thì sao?

Đây là việc khác với gói nội dung: nhờ Claude *"tạo release v0.2.0"*. GitHub tự build Windows, Android, web. Sau đó:

- **Android (Obtainium):** tự báo có bản mới. Trong app cũng hiện thông báo kèm nút tải.
- **Windows:** trong app hiện thông báo kèm nút tải bản cài mới; cài đè lên bản cũ, dữ liệu học được giữ.
- **Web/PWA:** hiện nút *Tải lại để dùng bản mới*.

Nội dung học thì không cần bản app mới, chỉ cần đăng gói như trên.

## Máy tính tự làm gì phía sau (để bạn yên tâm)

1. Khi bạn merge, GitHub chạy `npm run packs:build`: tạo bản đầy đủ mới nhất, các gói chênh lệch giữa hai phiên bản liền kề, và `catalog.json` ghi mã kiểm tra (SHA-256) của từng file.
2. Các file này được đăng tại `https://fedya3012.github.io/Yomineko/content/`.
3. App tải `catalog.json` (rất nhỏ), tự chọn cách tải ít nhất, kiểm tra mã SHA-256 (sai là bỏ), rồi cài trong một lần, được ăn cả ngã về không. Bộ nhớ nội dung và bộ nhớ tiến độ học là hai chỗ riêng nên việc cập nhật không đụng đến tiến độ.

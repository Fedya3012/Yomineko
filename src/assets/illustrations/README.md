# Hình minh hoạ Yomineko

Tất cả là hình vẽ nguyên bản, theo kiểu huy hiệu sticker: nét mực đậm `#0f3640` và màu phẳng. Mỗi hình có bản `-light` (nền giấy kem) và bản `-dark` (đêm). Riêng `street-night.svg` vốn là cảnh đêm nên chỉ có một bản.

| File | Dùng cho |
|---|---|
| `mochi-{happy,cheer,sleepy,sad}-{light,dark}.svg` | Mèo Mochi: vui, reo hò, buồn ngủ (màn trống), lo lắng (màn lỗi) |
| `mochi-reading-{light,dark}.svg` | Màn trống của Thư viện và Sách giáo khoa |
| `shopfront-{light,dark}.svg` | Ảnh lớn ở trang chủ (hiệu sách よみねこ書店) |
| `street-night.svg` | Ảnh giữ chỗ cho video, bìa phim |
| `badge-{coral,teal,mint,sky,mustard}-{light,dark}.svg` | Khung huy hiệu tròn quanh biểu tượng |

Trong app, Mochi được vẽ bằng `src/lib/ui/Mochi.svelte` và nét vẽ trùng với các file này. Ở bản dark, Mochi có thêm viền kem để vẫn nhìn rõ trên nền tối.

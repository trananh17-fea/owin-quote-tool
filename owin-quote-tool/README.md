# OWIN Quote Tool — phát triển

Tài liệu đầy đủ về chức năng, công thức, kiến trúc, dữ liệu, đồng bộ, ảnh, xuất tài liệu, phân quyền và triển khai nằm tại **[README gốc](../README.md)**. Đây là điểm tra cứu chính để tránh hai bản mô tả nghiệp vụ khác nhau.

## Chạy local

Dùng Node.js 22 và npm, chạy trong thư mục chứa file này:

```powershell
Copy-Item .env.example .env
npm ci
```

Điền `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` vào `.env`, áp dụng [schema](supabase/schema.sql) và cấu hình tài khoản theo [Supabase setup](supabase/SETUP.md), sau đó:

```powershell
npm run dev
```

## Kiểm tra

```powershell
npm run lint
npm test
npm run build
npm run preview
```

Build kiểm tra TypeScript và tạo `dist/`; preview phục vụ bản build local. `VITE_*` được nhúng vào frontend, chỉ dùng URL/anon key công khai.

## Bản đồ mã nguồn

| Phần | Vị trí |
| --- | --- |
| Shell/điều hướng | `src/App.tsx` |
| Màn hình/store | `src/features/` |
| Công thức báo giá | `src/lib/quoteEngine/`, `src/lib/quote/quoteCalculator.ts` |
| Bảng giá/thứ tự | `src/lib/catalogue/`, `src/lib/products/`, `src/lib/quote/quoteItemOrder.ts` |
| Tính nhôm | `src/lib/aluminumEstimator/`, `src/features/aluminum/` |
| Dữ liệu/đồng bộ | `src/services/supabase/`, `supabase/schema.sql` |
| Kiểu document | `src/types/models.ts` |
| Ảnh | `src/lib/media/`, `src/services/supabase/imagesRepo.ts` |
| Word/Excel/PDF | `src/features/export/`; Word/in nhôm ở `src/lib/aluminumEstimator/` |
| Template | `src/assets/templates/` |

Sửa công thức chạy `npx vitest run src/lib/quoteEngine src/lib/quote`; sửa template chạy `npx vitest run src/features/export` và kiểm tra trực quan file xuất. Giữ marker đúng hợp đồng DOCX, import bằng `@/`, component PascalCase và file logic camelCase.

Sản phẩm/báo giá lưu thủ công; xuất từ form báo giá không tự lưu. Đơn giá tính nhôm tự lưu còn số lượng chỉ trong phiên. Đọc quy tắc chi tiết trong README gốc trước khi sửa store/công thức.

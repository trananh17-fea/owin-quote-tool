# OWIN Quote Tool — Dev

Portfolio overview (không lộ kiến trúc source): **[README monorepo](../README.md)** · live: [saigonfox.online](https://saigonfox.online)

## Local

```bash
cp .env.example .env
npm ci
npm run dev
```

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

```bash
npm run lint && npm test && npm run build
```

Supabase schema / secrets Pages: `supabase/SETUP.md`.  
Chỉ `anon` key trên frontend — không `service_role`.

## Triển khai GitHub Pages

- Source: GitHub Actions.
- Production domain: `saigonfox.online`.
- Build root: `owin-quote-tool`.
- Required Actions secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Workflow chạy lint, test và production build trước khi deploy.
- `service_role`, PAT và mật khẩu người dùng không được đưa vào repository hoặc bundle.

Dữ liệu nghiệp vụ nằm hoàn toàn trên Supabase; bản production không dùng browser database.

## Cấu trúc & quy ước đặt tên

```text
src/
  components/     UI dùng chung, không gắn nghiệp vụ
  features/       theo màn hình: aluminum, auth, catalogue, export, products, quote, suggestions
  lib/            logic thuần, không phụ thuộc React (quoteEngine, quote, products, media, format, browser…)
  services/       hạ tầng ngoài: services/supabase (client + repo)
  styles/ types/  CSS toàn cục và kiểu dữ liệu chung
```

Quy ước:

- **File component React** → `PascalCase.tsx` (`ProductForm.tsx`). **Mọi file khác** → `camelCase.ts` (`quoteStore.ts`). **Thư mục** → `camelCase` (`lib/quoteEngine/`).
- **Identifier tiếng Anh**; chuỗi hiển thị cho người dùng và comment/JSDoc giữ tiếng Việt.
- **Import trong `src/` luôn dùng alias `@/`** (không dùng đường dẫn tương đối) — đổi vị trí file không phải sửa import.
- `lib/` không được import từ `features/`; `features/` gọi xuống `lib/` và `services/`.
- Hằng số nghiệp vụ BR-1/BR-2/BR-3/BR-1b/BR-6 mô tả ở đầu `src/lib/quoteEngine/index.ts`,
  có test chặn hồi quy trong `src/lib/quoteEngine/*.test.ts` (81 assertion). Sửa công thức giá thì chạy
  `npx vitest run src/lib/quoteEngine` trước.
- Tên placeholder trong 2 file `.docx` là **dữ liệu** — phải khớp đúng marker có sẵn trong template,
  không được tự đổi trong code. Danh sách marker thật ghi ở đầu `features/export/wordExport.ts`
  (báo giá: `{nhom}`, `{stt}`/`{ma_sp}`/`{anh_sp}`, `{bo_pk_*}`, `{pk_*}`, `{ps_*}`;
  bảng giá: `{category}`, `{product_info_block}`, `{accessory_block}`).
  `features/export/templateContract.node.test.ts` khoá hợp đồng này: danh sách marker của
  từng `.docx`, marker code dùng phải có thật trong template, và marker template không được
  điền chỉ được là marker neo đã biết. Thay template hoặc đổi marker trong code là test đỏ ngay.

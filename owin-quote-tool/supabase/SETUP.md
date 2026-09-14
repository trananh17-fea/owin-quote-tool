# Supabase + GitHub Pages

## Supabase

1. Project mới: chạy toàn bộ `schema.sql` trong SQL Editor. File có thể chạy lại an toàn.
2. Project đã có dữ liệu theo schema cũ: chạy `migrations/0001_multi_store_and_naming.sql` **trước**, rồi mới chạy `schema.sql`. Migration đổi tên bảng/cột và gán dữ liệu cũ vào cửa hàng `owin`; bản web đang deploy sẽ hỏng cho tới khi deploy code mới.
3. Bật Email/Password Auth. Muốn đăng nhập Google/Facebook thì bật provider tương ứng trong Authentication → Providers và thêm URL ứng dụng vào Redirect URLs.
4. Bucket `product-images` cho URL ảnh catalogue công khai nhưng chặn anon list; bucket `quote-images` private cho ảnh riêng trong báo giá. RLS và Realtime được cấu hình bởi schema.
5. Chỉ đưa Project URL và anon key vào frontend. Không bao giờ đưa `service_role` hoặc PAT vào GitHub Pages.

## Mô hình đa cửa hàng

Tài khoản, mật khẩu, Google/Facebook và quên mật khẩu do Supabase Auth quản lý trong schema `auth`. Không có bảng user tự viết và không tự lưu mật khẩu.

| Bảng | Vai trò |
| --- | --- |
| `profiles` | Hồ sơ 1-1 với `auth.users`: tên hiển thị, email, ảnh đại diện |
| `stores` | Cửa hàng; `is_public` quyết định landing page có đọc được bảng giá không |
| `store_members` | Ai thuộc cửa hàng nào, `role` owner/admin/staff, `status` pending/active/disabled |
| `products` | Bảng giá riêng của từng cửa hàng + JSON document đầy đủ |
| `quotes` | Báo giá riêng của từng cửa hàng + snapshot đầy đủ |
| `suggestions` | Autocomplete đã học, dùng chung trong một cửa hàng |
| `app_documents` | Document cấu hình theo cửa hàng, gồm trạng thái tính nhôm |

Người đăng nhập lần đầu được tạo `profiles` tự động nhưng **chưa thuộc cửa hàng nào**, nên không thấy dữ liệu gì. Chủ cửa hàng phải thêm họ vào `store_members` với `status = 'active'`.

Duyệt thủ công trong SQL Editor khi chưa có giao diện quản trị:

```sql
insert into public.store_members (store_id, user_id, role, status)
select 'owin', id, 'staff', 'active' from auth.users where email = 'nguoimoi@example.com'
on conflict (store_id, user_id) do update set status = 'active';
```

Mọi bảng nghiệp vụ bật RLS và chỉ thành viên `active` của cửa hàng mới đọc/ghi được dữ liệu của cửa hàng đó. Trigger `revision` đánh dấu mỗi lần cập nhật; trigger xóa mềm ngăn một form cũ hồi sinh sản phẩm/báo giá đã bị xóa trên máy khác. Realtime là cơ chế tự cập nhật, không có nút Sync và không có browser database dự phòng.

Storage **chưa** đóng khung theo cửa hàng: tài khoản đã đăng nhập vẫn đọc/ghi được ảnh của cửa hàng khác nếu biết đường dẫn. Siết lại cần migrate đường dẫn ảnh sang dạng `<store_id>/...` trước.

## GitHub Pages

Repository Settings → Secrets and variables → Actions cần hai secret:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Push vào `main` chạy CI rồi workflow Deploy GitHub Pages. Domain production là `saigonfox.online` và file `public/CNAME` giữ custom domain.

## Trạng thái migration

Dữ liệu trình duyệt cũ đã được chuyển lên Supabase. Bản production không còn importer hoặc browser database.

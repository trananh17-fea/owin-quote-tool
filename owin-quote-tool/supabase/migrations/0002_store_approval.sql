-- ============================================================================
-- MIGRATION 0002 — luồng duyệt cửa hàng và thành viên
--
-- Chạy SAU 0001. Chạy xong thì chạy lại schema.sql để hội tụ policy/hàm.
--
-- Thêm hai luồng tự phục vụ, thay cho việc quản trị bằng SQL tay:
--   • Người lạ đăng ký MỞ CỬA HÀNG MỚI  → Quản trị viên hệ thống duyệt.
--   • Người lạ XIN VÀO cửa hàng có sẵn  → chủ/quản lý cửa hàng đó duyệt.
--
-- Quản trị viên hệ thống là vai trò MỚI, khác `owner` (chủ một cửa hàng):
-- đánh dấu bằng profiles.is_platform_admin.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Cột mới
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_platform_admin boolean not null default false;

alter table public.stores
  add column if not exists status text not null default 'pending';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'stores_status_check') then
    alter table public.stores add constraint stores_status_check
      check (status in ('pending', 'active', 'rejected'));
  end if;
end $$;

-- Cửa hàng đã tồn tại trước luồng duyệt thì đương nhiên là đã hoạt động.
update public.stores set status = 'active' where status = 'pending';

-- Chủ cửa hàng gốc là Quản trị viên hệ thống đầu tiên.
update public.profiles set is_platform_admin = true
where id in (select owner_id from public.stores where id = 'owin');

create index if not exists stores_status_idx on public.stores (status);

-- ---------------------------------------------------------------------------
-- 2. Vai trò cấp cửa hàng: 'admin' → 'manager'
--
-- Chữ "admin" từ nay chỉ có một nghĩa là Quản trị viên hệ thống. Vai trò quản
-- lý bên trong một cửa hàng đổi tên để không mang cùng một chữ với hai nghĩa.
-- ---------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'store_members_role_check') then
    alter table public.store_members drop constraint store_members_role_check;
  end if;
end $$;

update public.store_members set role = 'manager' where role = 'admin';

alter table public.store_members add constraint store_members_role_check
  check (role in ('owner', 'manager', 'staff'));

-- Hàm đổi tên theo, bản cũ không còn ai gọi.
drop function if exists public.current_store_admin_ids();

commit;

-- Phần còn lại (hàm tra quyền, RPC, policy) nằm trong schema.sql và được
-- `create or replace` nên chạy schema.sql là đủ. Chạy tiếp file đó ngay.

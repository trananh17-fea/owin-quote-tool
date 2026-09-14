-- ============================================================================
-- MIGRATION 0001 — chuẩn hóa tên + chuyển sang mô hình đa cửa hàng
--
-- CHẠY FILE NÀY TRƯỚC, RỒI CHẠY schema.sql. Không đảo thứ tự: policy trong
-- schema.sql tham chiếu cột store_id mà file này mới tạo ra.
--
-- Toàn bộ nằm trong một transaction: sai ở đâu là rollback sạch, không để lại
-- database nửa vời.
--
-- CẢNH BÁO: sau khi chạy, bản web đang deploy sẽ HỎNG cho tới khi deploy bản
-- code mới (tên bảng/cột/RPC đều đổi). Chạy khi không có ai đang dùng.
--
-- Dữ liệu hiện có được gán hết vào cửa hàng id='owin', chủ là tài khoản
-- hoanganhowin@gmail.com (không có thì lấy tài khoản tạo sớm nhất).
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Bảng mới: profiles, stores, store_members
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email        text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.stores (
  id         text primary key,
  name       text not null,
  slug       text unique,
  is_public  boolean not null default false,
  owner_id   uuid not null references auth.users (id),
  created_by uuid references auth.users (id) default auth.uid(),
  updated_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists stores_owner_id_idx   on public.stores (owner_id);
create index if not exists stores_deleted_at_idx on public.stores (deleted_at);

create table if not exists public.store_members (
  store_id   text not null references public.stores (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'staff'
               check (role in ('owner', 'manager', 'staff')),
  status     text not null default 'pending'
               check (status in ('pending', 'active', 'disabled')),
  invited_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
create index if not exists store_members_user_id_idx on public.store_members (user_id);
create index if not exists store_members_status_idx  on public.store_members (status);

-- ---------------------------------------------------------------------------
-- 2. Cửa hàng gốc + hồ sơ cho các tài khoản đã có
-- ---------------------------------------------------------------------------
do $$
declare
  -- >>> KIỂM TRA DANH SÁCH NÀY TRƯỚC KHI CHẠY <<<
  -- Các tài khoản quản trị OWIN. Tất cả đều thành chủ cửa hàng 'owin' và
  -- Quản trị viên hệ thống. Sai email là trao bảng giá lẫn báo giá cho nhầm
  -- người, nên đối chiếu với Authentication → Users trước khi chạy.
  admin_emails constant text[] := array[
    'thanhvu.220809@gmail.com',
    'hoanganhowin@gmail.com'
  ];
  admin_id uuid;
  found_admins integer;
  user_count integer;
begin
  select count(*) into found_admins from auth.users
   where lower(email) in (select lower(item) from unnest(admin_emails) as item);

  -- owner_id của bảng stores chỉ nhận đúng một người; những admin còn lại vẫn
  -- được cấp vai trò 'owner' trong store_members ở dưới.
  select id into admin_id from auth.users
   where lower(email) in (select lower(item) from unnest(admin_emails) as item)
   order by created_at
   limit 1;

  if admin_id is null then
    select count(*) into user_count from auth.users;

    if user_count = 0 then
      raise exception
        'auth.users trống — tạo tài khoản quản trị trước khi chạy migration';
    end if;

    -- Chỉ đoán khi không thể đoán sai. Nhiều tài khoản mà không khớp email nào
    -- thì dừng lại, đừng âm thầm trao dữ liệu cho một người ngẫu nhiên.
    if user_count > 1 then
      raise exception
        'Không tìm thấy admin nào trong % và đang có % tài khoản. Sửa admin_emails ở đầu khối này rồi chạy lại.',
        admin_emails, user_count;
    end if;

    select id into admin_id from auth.users limit 1;
  else
    raise notice 'Tìm thấy % / % tài khoản quản trị.', found_admins, array_length(admin_emails, 1);
  end if;

  insert into public.profiles (id, display_name, email, avatar_url)
  select
    u.id,
    coalesce(
      nullif(u.raw_user_meta_data->>'full_name', ''),
      nullif(u.raw_user_meta_data->>'name', ''),
      split_part(coalesce(u.email, ''), '@', 1)
    ),
    u.email,
    nullif(u.raw_user_meta_data->>'avatar_url', '')
  from auth.users u
  on conflict (id) do nothing;

  -- is_public = true để landing page vẫn đọc được bảng giá như trước.
  insert into public.stores (id, name, slug, is_public, owner_id, created_by, updated_by)
  values ('owin', 'OWIN', 'owin', true, admin_id, admin_id, admin_id)
  on conflict (id) do nothing;

  -- Trước migration, RLS cũ chỉ xét `authenticated`, nghĩa là MỌI tài khoản đã
  -- đăng nhập đều thấy toàn bộ dữ liệu. Đưa hết vào cửa hàng để không ai mất
  -- quyền khi RLS siết theo store. Vai trò 'staff' giữ đúng mức truy cập dữ
  -- liệu như cũ — nó chỉ không được duyệt thành viên, việc trước đây chưa tồn tại.
  insert into public.store_members (store_id, user_id, role, status)
  select 'owin', u.id, 'staff', 'active'
  from auth.users u
  on conflict (store_id, user_id) do nothing;

  -- Mọi tài khoản quản trị đều là chủ cửa hàng, ghi đè dòng 'staff' ở trên.
  insert into public.store_members (store_id, user_id, role, status)
  select 'owin', u.id, 'owner', 'active'
  from auth.users u
  where lower(u.email) in (select lower(item) from unnest(admin_emails) as item)
     or u.id = admin_id
  on conflict (store_id, user_id) do update
    set role = 'owner', status = 'active';
end $$;

-- ---------------------------------------------------------------------------
-- 3. Dọn policy / trigger mang tên cũ
-- ---------------------------------------------------------------------------
drop policy if exists products_auth_all      on public.products;
drop policy if exists products_public_read   on public.products;
drop policy if exists quotes_auth_all        on public.quotes;
drop policy if exists suggestions_auth_all   on public.suggestions;
drop policy if exists app_data_auth_all      on public.app_data;
drop policy if exists product_images_read    on storage.objects;
drop policy if exists product_images_write   on storage.objects;
drop policy if exists quote_images_auth_all  on storage.objects;

drop trigger if exists products_touch    on public.products;
drop trigger if exists quotes_touch      on public.quotes;
drop trigger if exists suggestions_touch on public.suggestions;
drop trigger if exists app_data_touch    on public.app_data;

-- ---------------------------------------------------------------------------
-- 4. Đổi tên bảng app_data → app_documents
-- ---------------------------------------------------------------------------
do $$ begin
  if to_regclass('public.app_data') is not null
     and to_regclass('public.app_documents') is null then
    alter table public.app_data rename to app_documents;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Đổi tên cột
-- ---------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'products'
               and column_name = 'size_text') then
    alter table public.products rename column size_text to raw_size_text;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'quotes'
               and column_name = 'owner') then
    alter table public.quotes rename column owner to owner_id;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'app_documents'
               and column_name = 'owner') then
    alter table public.app_documents rename column owner to owner_id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Thêm store_id cho dữ liệu nghiệp vụ rồi gán về cửa hàng 'owin'
-- ---------------------------------------------------------------------------
alter table public.products      add column if not exists store_id text;
alter table public.quotes        add column if not exists store_id text;
alter table public.suggestions   add column if not exists store_id text;
alter table public.app_documents add column if not exists store_id text;

update public.products      set store_id = 'owin' where store_id is null;
update public.quotes        set store_id = 'owin' where store_id is null;
update public.suggestions   set store_id = 'owin' where store_id is null;
update public.app_documents set store_id = 'owin' where store_id is null;

alter table public.products      alter column store_id set not null;
alter table public.quotes        alter column store_id set not null;
alter table public.suggestions   alter column store_id set not null;
alter table public.app_documents alter column store_id set not null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_store_id_fkey') then
    alter table public.products add constraint products_store_id_fkey
      foreign key (store_id) references public.stores (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quotes_store_id_fkey') then
    alter table public.quotes add constraint quotes_store_id_fkey
      foreign key (store_id) references public.stores (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'suggestions_store_id_fkey') then
    alter table public.suggestions add constraint suggestions_store_id_fkey
      foreign key (store_id) references public.stores (id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'app_documents_store_id_fkey') then
    alter table public.app_documents add constraint app_documents_store_id_fkey
      foreign key (store_id) references public.stores (id) on delete cascade;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. app_documents: khóa document cũ nằm ở cột `key`, đổi tên thành `id`
-- ---------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'app_documents'
               and column_name = 'key') then
    alter table public.app_documents rename column key to id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Khóa chính ghép (store_id, id) cho mọi bảng nghiệp vụ
--
-- products.id và suggestions.id sinh từ dữ liệu nghiệp vụ (mã sản phẩm,
-- type+value) nên hai cửa hàng hoàn toàn có thể trùng id. Khóa chính toàn cục
-- sẽ chặn cửa hàng thứ hai lưu; ghép store_id vào khóa là cách giữ nguyên id
-- cũ mà vẫn tách được dữ liệu giữa các cửa hàng.
-- ---------------------------------------------------------------------------
do $$
declare
  target text;
  pk_name text;
begin
  foreach target in array array['products', 'quotes', 'suggestions', 'app_documents'] loop
    select conname into pk_name
    from pg_constraint
    where conrelid = ('public.' || target)::regclass and contype = 'p';

    if pk_name is not null then
      execute format('alter table public.%I drop constraint %I', target, pk_name);
    end if;

    execute format(
      'alter table public.%I add constraint %I primary key (store_id, id)',
      target, target || '_pkey'
    );
  end loop;
end $$;

-- Mã sản phẩm / báo giá chỉ cần duy nhất TRONG một cửa hàng, không toàn cục.
do $$ begin
  if exists (select 1 from pg_constraint where conname = 'products_code_key') then
    alter table public.products drop constraint products_code_key;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_store_id_code_key') then
    alter table public.products
      add constraint products_store_id_code_key unique (store_id, code);
  end if;

  if exists (select 1 from pg_constraint where conname = 'quotes_code_key') then
    alter table public.quotes drop constraint quotes_code_key;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quotes_store_id_code_key') then
    alter table public.quotes
      add constraint quotes_store_id_code_key unique (store_id, code);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 9. Cột thời gian còn thiếu; lấy mốc từ JSON document, không lấy now()
-- ---------------------------------------------------------------------------
alter table public.products      add column if not exists created_at timestamptz;
alter table public.quotes        add column if not exists created_at timestamptz;
alter table public.suggestions   add column if not exists created_at timestamptz;
alter table public.app_documents add column if not exists created_at timestamptz;

alter table public.suggestions   add column if not exists deleted_at timestamptz;
alter table public.app_documents add column if not exists deleted_at timestamptz;

update public.products
set created_at = coalesce(
  case when data->>'createdAt' ~ '^\d{4}-\d{2}-\d{2}' then (data->>'createdAt')::timestamptz end,
  updated_at, now())
where created_at is null;

update public.quotes
set created_at = coalesce(
  case when data->>'createdAt' ~ '^\d{4}-\d{2}-\d{2}' then (data->>'createdAt')::timestamptz end,
  updated_at, now())
where created_at is null;

update public.suggestions
set created_at = coalesce(
  case when data->>'createdAt' ~ '^\d{4}-\d{2}-\d{2}' then (data->>'createdAt')::timestamptz end,
  updated_at, now())
where created_at is null;

update public.app_documents
set created_at = coalesce(
  case when data->>'createdAt' ~ '^\d{4}-\d{2}-\d{2}' then (data->>'createdAt')::timestamptz end,
  updated_at, now())
where created_at is null;

update public.suggestions
set deleted_at = (data->>'deletedAt')::timestamptz
where deleted_at is null and data->>'deletedAt' ~ '^\d{4}-\d{2}-\d{2}';

-- ---------------------------------------------------------------------------
-- 10. Siết ràng buộc lỏng
-- ---------------------------------------------------------------------------
update public.products      set updated_at = now() where updated_at is null;
update public.quotes        set updated_at = now() where updated_at is null;
update public.suggestions   set updated_at = now() where updated_at is null;
update public.app_documents set updated_at = now() where updated_at is null;
update public.products      set is_public = true  where is_public is null;
update public.products      set code = id         where code is null;

alter table public.products      alter column created_at set not null;
alter table public.quotes        alter column created_at set not null;
alter table public.suggestions   alter column created_at set not null;
alter table public.app_documents alter column created_at set not null;
alter table public.products      alter column created_at set default now();
alter table public.quotes        alter column created_at set default now();
alter table public.suggestions   alter column created_at set default now();
alter table public.app_documents alter column created_at set default now();

alter table public.products      alter column updated_at set not null;
alter table public.quotes        alter column updated_at set not null;
alter table public.suggestions   alter column updated_at set not null;
alter table public.app_documents alter column updated_at set not null;

alter table public.products alter column code      set not null;
alter table public.products alter column is_public set not null;
alter table public.products alter column is_public set default true;

-- ---------------------------------------------------------------------------
-- 11. Đổi tên index cho khớp tên cột
-- ---------------------------------------------------------------------------
alter index if exists public.products_sort_idx rename to products_sort_order_idx;
alter index if exists public.quotes_date_idx   rename to quotes_quote_date_idx;
alter index if exists public.quotes_owner_idx  rename to quotes_owner_id_idx;

commit;

-- Chạy tiếp supabase/schema.sql để dựng lại policy, trigger, RPC theo tên mới.

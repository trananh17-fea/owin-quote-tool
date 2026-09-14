-- ============================================================================
-- OWIN QUOTE TOOL — Supabase schema
-- Dán toàn bộ file này vào Supabase → SQL Editor → Run. File chạy lại an toàn.
--
-- Project ĐÃ CHẠY bản schema cũ thì phải chạy supabase/migrations/ theo thứ tự
-- TRƯỚC, vì file này không tự đổi tên cột trên bảng đã tồn tại.
--
-- MÔ HÌNH ĐA CỬA HÀNG (multi-store)
--   • Mỗi cửa hàng là một dòng trong `stores`, có nhiều nhân viên qua
--     `store_members`. Một tài khoản có thể thuộc nhiều cửa hàng.
--   • Toàn bộ dữ liệu nghiệp vụ (bảng giá, báo giá, gợi ý, cấu hình) đều mang
--     `store_id`. RLS chỉ cho thấy dữ liệu của cửa hàng mình là thành viên.
--   • Người mới đăng nhập Google/Facebook chưa thuộc cửa hàng nào thì KHÔNG
--     thấy gì cho tới khi được duyệt (`store_members.status = 'active'`).
--   • Đăng nhập, đổi/quên mật khẩu, Google, Facebook do Supabase Auth lo trong
--     schema `auth`. KHÔNG tự tạo bảng user và KHÔNG tự lưu mật khẩu.
--
-- Mô hình "document + cột index": record đầy đủ nằm trong jsonb `data`,
-- đồng thời các cột thường dùng được tách riêng để query/hiển thị nhanh.
--
-- QUY ƯỚC ĐẶT TÊN (áp dụng cho mọi bảng, cột, index, trigger, policy, hàm):
--   • snake_case, không dùng nháy kép.
--   • Tên bảng số nhiều: products, quotes, suggestions, app_documents, stores.
--   • Khóa chính luôn tên `id` (trừ bảng nối dùng khóa chính ghép).
--   • Vai trò trong cửa hàng: owner | manager | staff. Chữ "admin" chỉ dùng
--     cho Quản trị viên hệ thống (profiles.is_platform_admin).
--   • Khóa ngoại tới auth.users: `owner_id`, `user_id`, `created_by`,
--     `updated_by`, `invited_by`. Khóa ngoại tới stores: `store_id`.
--   • Mốc thời gian hậu tố `_at`; tiền tệ hậu tố `_vnd`; boolean tiền tố `is_`.
--   • Index đặt `<bảng>_<cột>_idx`; trigger đặt `<bảng>_<tên_hàm>`.
--   • Policy đặt `<bảng>_<đối_tượng>_<hành_động>`.
--   • Tham số hàm luôn có tiền tố `p_` để không trùng tên cột.
--   • Thứ tự cột thống nhất: id → store_id → cột nghiệp vụ → data → audit.
-- ============================================================================

-- ---------- Hồ sơ tài khoản ----------
-- Mỗi dòng khớp 1-1 với auth.users. Chỉ chứa thứ Supabase Auth không giữ hộ.
create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text,
  email             text,
  avatar_url        text,
  -- Quản trị viên hệ thống: duyệt cửa hàng mới. Khác `owner` (chủ một cửa hàng).
  is_platform_admin boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------- Cửa hàng ----------
create table if not exists public.stores (
  id         text primary key,
  name       text not null,
  slug       text unique,                     -- cũng là "mã cửa hàng" nhân viên nhập để xin vào
  status     text not null default 'pending'
               check (status in ('pending', 'active', 'rejected')),
  is_public  boolean not null default false,  -- landing page có được đọc bảng giá không
  owner_id   uuid not null references auth.users (id),
  created_by uuid references auth.users (id) default auth.uid(),
  updated_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists stores_owner_id_idx   on public.stores (owner_id);
create index if not exists stores_status_idx     on public.stores (status);
create index if not exists stores_deleted_at_idx on public.stores (deleted_at);

-- ---------- Thành viên cửa hàng ----------
-- status='pending' là người vừa đăng nhập, chờ chủ cửa hàng duyệt.
create table if not exists public.store_members (
  store_id   text not null references public.stores (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- 'manager' chứ không phải 'admin': chữ admin dành riêng cho Quản trị viên
  -- hệ thống (profiles.is_platform_admin), tránh một chữ mang hai nghĩa.
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

-- ---------- Hàm tra cứu quyền ----------
-- security definer để bỏ qua RLS của store_members, nếu không policy gọi lại
-- chính bảng đang kiểm tra và gây đệ quy vô hạn.
create or replace function public.current_store_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select member.store_id
  from public.store_members member
  join public.stores store on store.id = member.store_id
  where member.user_id = auth.uid()
    and member.status = 'active'
    and store.status = 'active'
    and store.deleted_at is null;
$$;

-- Cửa hàng mà tài khoản hiện tại quản lý được (duyệt/mời/xoá thành viên).
create or replace function public.current_store_manager_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select member.store_id
  from public.store_members member
  join public.stores store on store.id = member.store_id
  where member.user_id = auth.uid()
    and member.status = 'active'
    and member.role in ('owner', 'manager')
    and store.status = 'active'
    and store.deleted_at is null;
$$;

-- Cửa hàng cho phép landing page đọc bảng giá công khai.
create or replace function public.public_store_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select id from public.stores
  where is_public = true and status = 'active' and deleted_at is null;
$$;

-- Quản trị viên hệ thống: duyệt cửa hàng mới. Khác `owner` của một cửa hàng.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_platform_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- ---------- Bảng sản phẩm (bảng giá) ----------
create table if not exists public.products (
  id               text not null,                -- dùng product code hiện tại làm id
  store_id         text not null references public.stores (id) on delete cascade,
  code             text not null,
  name             text,
  category         text,
  unit             text,
  unit_price_vnd   bigint,
  raw_size_text    text,
  cover_image_path text,                          -- đường dẫn ảnh trong Storage bucket
  sort_order       integer,
  is_public        boolean not null default true, -- để landing page lọc
  data             jsonb not null,                -- full ProductRecord (không mất gì)
  revision         bigint not null default 1,
  created_by       uuid references auth.users (id) default auth.uid(),
  updated_by       uuid references auth.users (id) default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  -- Khóa chính ghép: mã sản phẩm chỉ cần duy nhất trong một cửa hàng.
  primary key (store_id, id),
  unique (store_id, code)
);
create index if not exists products_store_id_idx   on public.products (store_id);
create index if not exists products_category_idx   on public.products (category);
create index if not exists products_sort_order_idx on public.products (sort_order);
create index if not exists products_deleted_at_idx on public.products (deleted_at);

-- ---------- Bảng báo giá ----------
create table if not exists public.quotes (
  id               text not null,
  store_id         text not null references public.stores (id) on delete cascade,
  code             text,
  customer_name    text,
  customer_phone   text,
  quote_date       date,
  status           text,
  total_vnd        bigint,
  data             jsonb not null,                -- full QuoteRecord
  owner_id         uuid references auth.users (id) default auth.uid(),
  revision         bigint not null default 1,
  created_by       uuid references auth.users (id) default auth.uid(),
  updated_by       uuid references auth.users (id) default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  primary key (store_id, id),
  unique (store_id, code)
);
create index if not exists quotes_store_id_idx   on public.quotes (store_id);
create index if not exists quotes_owner_id_idx   on public.quotes (owner_id);
create index if not exists quotes_quote_date_idx on public.quotes (quote_date);
create index if not exists quotes_deleted_at_idx on public.quotes (deleted_at);

-- ---------- Gợi ý autocomplete ----------
-- Học theo từng cửa hàng: nhân viên cùng cửa hàng dùng chung pool gợi ý.
create table if not exists public.suggestions (
  id          text not null,
  store_id    text not null references public.stores (id) on delete cascade,
  type        text not null,
  value       text not null,
  used_count  integer not null default 1,
  data        jsonb not null,
  revision    bigint not null default 1,
  created_by  uuid references auth.users (id) default auth.uid(),
  updated_by  uuid references auth.users (id) default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (store_id, id)
);
create index if not exists suggestions_store_id_idx   on public.suggestions (store_id);
create index if not exists suggestions_type_value_idx on public.suggestions (store_id, type, value);
create index if not exists suggestions_deleted_at_idx on public.suggestions (deleted_at);

-- ---------- Document cấu hình theo cửa hàng ----------
-- Meta/cấu hình và trạng thái tính nhôm giữ nguyên shape app dưới dạng document.
create table if not exists public.app_documents (
  id          text not null,                     -- khoá document trong phạm vi cửa hàng
  store_id    text not null references public.stores (id) on delete cascade,
  data        jsonb not null,
  owner_id    uuid references auth.users (id) default auth.uid(),
  revision    bigint not null default 1,
  created_by  uuid references auth.users (id) default auth.uid(),
  updated_by  uuid references auth.users (id) default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (store_id, id)
);
create index if not exists app_documents_store_id_idx on public.app_documents (store_id);

-- ---------- Cấp quyền cho Data API (vì "auto expose new tables" đang tắt) ----------
grant usage on schema public to anon, authenticated;
grant select on public.products to anon;
grant all privileges on public.profiles      to authenticated;
grant all privileges on public.stores        to authenticated;
grant all privileges on public.store_members to authenticated;
grant all privileges on public.products      to authenticated;
grant all privileges on public.quotes        to authenticated;
grant all privileges on public.suggestions   to authenticated;
grant all privileges on public.app_documents to authenticated;

-- ---------- RLS (Row Level Security) ----------
-- THÀNH VIÊN: chỉ thấy dữ liệu của cửa hàng mình đang active.
-- LANDING: anon chỉ SELECT products công khai của cửa hàng công khai.
alter table public.profiles      enable row level security;
alter table public.stores        enable row level security;
alter table public.store_members enable row level security;
alter table public.products      enable row level security;
alter table public.quotes        enable row level security;
alter table public.suggestions   enable row level security;
alter table public.app_documents enable row level security;

-- Hồ sơ: ai cũng đọc/sửa được hồ sơ của chính mình; đồng nghiệp đọc được nhau.
drop policy if exists profiles_self_all on public.profiles;
create policy profiles_self_all on public.profiles
  for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_teammate_read on public.profiles;
create policy profiles_teammate_read on public.profiles
  for select to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.store_members member
      where member.user_id = public.profiles.id
        and member.store_id in (select public.current_store_ids())
    )
  );

-- Cửa hàng: thành viên đọc được; chỉ owner/admin sửa được.
drop policy if exists stores_member_read on public.stores;
create policy stores_member_read on public.stores
  for select to authenticated
  using (id in (select public.current_store_ids()));

-- Chủ cửa hàng phải xem được cửa hàng của mình ngay cả khi còn chờ duyệt,
-- nếu không họ không biết yêu cầu đang ở trạng thái nào.
drop policy if exists stores_owner_read on public.stores;
create policy stores_owner_read on public.stores
  for select to authenticated
  using (owner_id = auth.uid());

-- Quản trị viên hệ thống thấy và duyệt được mọi cửa hàng.
drop policy if exists stores_platform_admin_all on public.stores;
create policy stores_platform_admin_all on public.stores
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists stores_admin_write on public.stores;
drop policy if exists stores_manager_write on public.stores;
create policy stores_manager_write on public.stores
  for update to authenticated
  using (id in (select public.current_store_manager_ids()))
  with check (id in (select public.current_store_manager_ids()));

-- Tạo cửa hàng mới: người tạo phải là chủ của chính cửa hàng đó.
drop policy if exists stores_owner_insert on public.stores;
create policy stores_owner_insert on public.stores
  for insert to authenticated
  with check (owner_id = auth.uid());

-- Thành viên: tự xem dòng của mình (để biết đang chờ duyệt hay đã active),
-- xem được đồng nghiệp, và chỉ owner/admin mới thêm/sửa/xoá.
drop policy if exists store_members_self_read on public.store_members;
create policy store_members_self_read on public.store_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_platform_admin()
    or store_id in (select public.current_store_ids())
  );

drop policy if exists store_members_admin_write on public.store_members;
drop policy if exists store_members_manager_write on public.store_members;
create policy store_members_manager_write on public.store_members
  for all to authenticated
  using (store_id in (select public.current_store_manager_ids()))
  with check (store_id in (select public.current_store_manager_ids()));

-- Dữ liệu nghiệp vụ: đóng khung theo cửa hàng.
drop policy if exists products_member_all on public.products;
create policy products_member_all on public.products
  for all to authenticated
  using (store_id in (select public.current_store_ids()))
  with check (store_id in (select public.current_store_ids()));

drop policy if exists products_anon_read on public.products;
create policy products_anon_read on public.products
  for select to anon
  using (
    deleted_at is null
    and is_public = true
    and store_id in (select public.public_store_ids())
  );

drop policy if exists quotes_member_all on public.quotes;
create policy quotes_member_all on public.quotes
  for all to authenticated
  using (store_id in (select public.current_store_ids()))
  with check (store_id in (select public.current_store_ids()));

drop policy if exists suggestions_member_all on public.suggestions;
create policy suggestions_member_all on public.suggestions
  for all to authenticated
  using (store_id in (select public.current_store_ids()))
  with check (store_id in (select public.current_store_ids()));

drop policy if exists app_documents_member_all on public.app_documents;
create policy app_documents_member_all on public.app_documents
  for all to authenticated
  using (store_id in (select public.current_store_ids()))
  with check (store_id in (select public.current_store_ids()));

-- ---------- Tạo hồ sơ tự động khi có tài khoản mới ----------
-- Chạy cho cả đăng ký email lẫn đăng nhập Google/Facebook lần đầu.
-- KHÔNG cấp quyền vào cửa hàng nào: người mới phải được duyệt.
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.email,
    nullif(new.raw_user_meta_data->>'avatar_url', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists users_create_profile on auth.users;
create trigger users_create_profile after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

-- ---------- Tự cập nhật updated_at ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  new.revision = old.revision + 1;
  new.updated_by = coalesce(auth.uid(), old.updated_by);
  return new;
end $$;

-- Bảng không có cột revision/updated_by thì chỉ chạm updated_at.
create or replace function public.touch_updated_at_only()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Xóa mềm luôn thắng một bản form cũ: client cũ không được vô tình hồi sinh
-- sản phẩm/báo giá đã bị xóa trên một máy khác.
create or replace function public.prevent_stale_restore()
returns trigger language plpgsql as $$
begin
  if old.deleted_at is not null and new.deleted_at is null then
    -- 23514 is non-retryable. SQLSTATE 40001 makes PostgREST retry the same
    -- forbidden restore until the browser request appears to hang.
    raise exception 'record_was_deleted_on_another_client' using errcode = '23514';
  end if;
  return new;
end $$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at_only();

drop trigger if exists stores_touch_updated_at on public.stores;
create trigger stores_touch_updated_at before update on public.stores
  for each row execute function public.touch_updated_at_only();

drop trigger if exists store_members_touch_updated_at on public.store_members;
create trigger store_members_touch_updated_at before update on public.store_members
  for each row execute function public.touch_updated_at_only();

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at before update on public.products
  for each row execute function public.touch_updated_at();
drop trigger if exists products_prevent_stale_restore on public.products;
create trigger products_prevent_stale_restore before update on public.products
  for each row execute function public.prevent_stale_restore();

drop trigger if exists quotes_touch_updated_at on public.quotes;
create trigger quotes_touch_updated_at before update on public.quotes
  for each row execute function public.touch_updated_at();
drop trigger if exists quotes_prevent_stale_restore on public.quotes;
create trigger quotes_prevent_stale_restore before update on public.quotes
  for each row execute function public.prevent_stale_restore();

drop trigger if exists suggestions_touch_updated_at on public.suggestions;
create trigger suggestions_touch_updated_at before update on public.suggestions
  for each row execute function public.touch_updated_at();

drop trigger if exists app_documents_touch_updated_at on public.app_documents;
create trigger app_documents_touch_updated_at before update on public.app_documents
  for each row execute function public.touch_updated_at();

-- ---------- RPC: đăng ký cửa hàng và xin vào cửa hàng ----------
-- Hai hàm này chạy security definer vì người gọi CHƯA thuộc cửa hàng nào, nên
-- chưa có policy nào cho họ ghi. Bù lại phải tự kiểm tra thật chặt: chỉ ghi
-- đúng dòng của chính auth.uid(), và luôn ở trạng thái chờ duyệt.

/* Đăng ký mở cửa hàng mới. Cửa hàng nằm ở trạng thái 'pending' cho tới khi
   Quản trị viên hệ thống duyệt, nên người đăng ký chưa đọc/ghi được gì. */
create or replace function public.request_new_store(p_name text, p_slug text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text := btrim(coalesce(p_name, ''));
  clean_slug text := lower(btrim(coalesce(p_slug, '')));
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;
  if clean_name = '' then
    raise exception 'store_name_required' using errcode = '22023';
  end if;
  if clean_slug !~ '^[a-z0-9][a-z0-9-]{2,39}$' then
    raise exception 'store_slug_invalid' using errcode = '22023';
  end if;
  if exists (select 1 from public.stores where slug = clean_slug or id = clean_slug) then
    raise exception 'store_slug_taken' using errcode = '23505';
  end if;
  -- Một người chỉ được treo một yêu cầu mở cửa hàng, tránh spam hàng loạt.
  if exists (
    select 1 from public.stores
    where owner_id = auth.uid() and status = 'pending'
  ) then
    raise exception 'store_request_pending' using errcode = '23505';
  end if;

  insert into public.stores (id, name, slug, status, owner_id, created_by, updated_by)
  values (clean_slug, clean_name, clean_slug, 'pending', auth.uid(), auth.uid(), auth.uid());

  -- Chủ được cấp quyền sẵn; cổng chặn nằm ở stores.status, không phải ở đây.
  insert into public.store_members (store_id, user_id, role, status)
  values (clean_slug, auth.uid(), 'owner', 'active')
  on conflict (store_id, user_id) do nothing;

  return clean_slug;
end $$;

/* Xin vào một cửa hàng đang hoạt động bằng mã cửa hàng (slug). Luôn tạo ở
   trạng thái 'pending' và vai trò 'staff' — người xin không tự nâng quyền được. */
create or replace function public.request_join_store(p_slug text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id text;
  current_status text;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '28000';
  end if;

  select id into target_id from public.stores
  where slug = lower(btrim(coalesce(p_slug, '')))
    and status = 'active'
    and deleted_at is null;

  if target_id is null then
    raise exception 'store_not_found' using errcode = '22023';
  end if;

  select status into current_status from public.store_members
  where store_id = target_id and user_id = auth.uid();

  if current_status = 'disabled' then
    raise exception 'store_member_disabled' using errcode = '28000';
  end if;

  insert into public.store_members (store_id, user_id, role, status)
  values (target_id, auth.uid(), 'staff', 'pending')
  on conflict (store_id, user_id) do nothing;

  return target_id;
end $$;

revoke all on function public.request_new_store(text, text) from public, anon;
revoke all on function public.request_join_store(text) from public, anon;
grant execute on function public.request_new_store(text, text) to authenticated;
grant execute on function public.request_join_store(text) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
revoke all on function public.is_platform_admin() from public, anon;

-- ---------- RPC: ghi document theo revision (compare-and-swap) ----------
-- Ghi document app_documents theo revision để hai trình duyệt không thể cùng
-- ghi đè một bản cũ. Revision 0 chỉ tạo mới khi document chưa tồn tại; update
-- chỉ thành công khi revision vẫn đúng. Không có dòng trả về = CAS conflict.
-- Mọi hàm đều security invoker nên RLS vẫn đóng khung theo cửa hàng.
drop function if exists public.compare_and_swap_app_data(text, bigint, jsonb);
drop function if exists public.save_app_document_cas(text, bigint, jsonb);
create or replace function public.save_app_document_cas(
  p_store_id text,
  p_id text,
  p_expected_revision bigint,
  p_data jsonb
)
returns table(data jsonb, revision bigint, updated_at timestamptz)
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_store_id is null or btrim(p_store_id) = ''
     or p_id is null or btrim(p_id) = ''
     or p_expected_revision < 0 then
    raise exception 'app_document_store_id_and_revision_required' using errcode = '22023';
  end if;

  if p_expected_revision = 0 then
    return query
      insert into public.app_documents as target (id, store_id, data)
      values (p_id, p_store_id, p_data)
      on conflict (store_id, id) do nothing
      returning target.data, target.revision, target.updated_at;
    return;
  end if;

  return query
    update public.app_documents as target
    set data = p_data
    where target.store_id = p_store_id
      and target.id = p_id
      and target.revision = p_expected_revision
    returning target.data, target.revision, target.updated_at;
end $$;

-- Các thao tác hàng loạt chỉ cập nhật đúng trường cần thiết ngay trong Postgres.
-- Không gửi lại cả JSON document cũ, tránh ghi đè chỉnh sửa từ máy khác.
drop function if exists public.set_product_order(text[]);
drop function if exists public.set_product_order(text, text[]);
create or replace function public.set_product_order(p_store_id text, p_ordered_ids text[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected integer;
  stamp text := to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  with desired as (
    select id, (ordinality - 1)::integer as sort_order
    from unnest(p_ordered_ids) with ordinality as item(id, ordinality)
  )
  update public.products as product
  set sort_order = desired.sort_order,
      data = jsonb_set(
        jsonb_set(product.data, '{sortOrder}', to_jsonb(desired.sort_order), true),
        '{updatedAt}', to_jsonb(stamp), true
      )
  from desired
  where product.id = desired.id
    and product.store_id = p_store_id
    and product.deleted_at is null;
  get diagnostics affected = row_count;
  return affected;
end $$;

drop function if exists public.adjust_product_prices(double precision);
drop function if exists public.adjust_product_prices(text, double precision);
create or replace function public.adjust_product_prices(
  p_store_id text,
  p_percent_change double precision
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  affected integer;
  stamp text := to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  with calculated as (
    select id,
      greatest(0, round(coalesce(unit_price_vnd, 0) * (1 + p_percent_change / 100.0)))::bigint as next_price
    from public.products
    where store_id = p_store_id and deleted_at is null
  )
  update public.products as product
  set unit_price_vnd = calculated.next_price,
      data = jsonb_set(
        jsonb_set(product.data, '{unitPriceVnd}', to_jsonb(calculated.next_price), true),
        '{updatedAt}', to_jsonb(stamp), true
      )
  from calculated
  where product.id = calculated.id;
  get diagnostics affected = row_count;
  return affected;
end $$;

-- Optimistic writes for full product/quote documents. The browser sends the
-- revision it last acknowledged. A stale token never writes: the RPC returns
-- the newest row so the client can 3-way merge independent fields and retry.
-- A NULL token means "insert if absent", making a retry after a lost insert
-- response idempotent because the stable document id cannot be inserted twice.
drop function if exists public.save_product_cas(jsonb, bigint);
drop function if exists public.save_product_cas(text, jsonb, bigint);
create or replace function public.save_product_cas(
  p_store_id text,
  p_proposed jsonb,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_id text := nullif(p_proposed->>'id', '');
  target_code text := nullif(p_proposed->>'code', '');
  proposed_deleted_at timestamptz := nullif(p_proposed->>'deletedAt', '')::timestamptz;
  current_row public.products%rowtype;
begin
  if p_store_id is null or target_id is null or target_code is null then
    raise exception 'product_store_id_and_code_required' using errcode = '22023';
  end if;

  if p_expected_revision is null then
    insert into public.products (
      id, store_id, code, name, category, unit, unit_price_vnd, raw_size_text,
      cover_image_path, sort_order, is_public, data, deleted_at
    ) values (
      target_id,
      p_store_id,
      target_code,
      nullif(p_proposed->>'name', ''),
      nullif(p_proposed->>'category', ''),
      nullif(p_proposed->>'unit', ''),
      round(coalesce(nullif(p_proposed->>'unitPriceVnd', '')::numeric, 0))::bigint,
      nullif(p_proposed->>'rawSizeText', ''),
      nullif(p_proposed->>'coverImagePath', ''),
      case when p_proposed ? 'sortOrder' then (p_proposed->>'sortOrder')::integer else null end,
      coalesce((p_proposed->>'isPublic')::boolean, true),
      p_proposed,
      proposed_deleted_at
    )
    on conflict (store_id, id) do nothing
    returning * into current_row;

    if found then
      return jsonb_build_object(
        'status', 'applied', 'id', current_row.id, 'data', current_row.data,
        'revision', current_row.revision, 'deleted_at', current_row.deleted_at
      );
    end if;
  end if;

  update public.products
  set code = target_code,
      name = nullif(p_proposed->>'name', ''),
      category = nullif(p_proposed->>'category', ''),
      unit = nullif(p_proposed->>'unit', ''),
      unit_price_vnd = round(coalesce(nullif(p_proposed->>'unitPriceVnd', '')::numeric, 0))::bigint,
      raw_size_text = nullif(p_proposed->>'rawSizeText', ''),
      cover_image_path = nullif(p_proposed->>'coverImagePath', ''),
      sort_order = case when p_proposed ? 'sortOrder' then (p_proposed->>'sortOrder')::integer else null end,
      is_public = coalesce((p_proposed->>'isPublic')::boolean, true),
      data = p_proposed,
      deleted_at = proposed_deleted_at
  where id = target_id
    and store_id = p_store_id
    and revision = p_expected_revision
    and deleted_at is null
  returning * into current_row;

  if found then
    return jsonb_build_object(
      'status', 'applied', 'id', current_row.id, 'data', current_row.data,
      'revision', current_row.revision, 'deleted_at', current_row.deleted_at
    );
  end if;

  select * into current_row from public.products
  where id = target_id and store_id = p_store_id;
  if not found then
    return jsonb_build_object('status', 'missing');
  end if;
  return jsonb_build_object(
    'status', case when current_row.deleted_at is null then 'conflict' else 'deleted' end,
    'id', current_row.id, 'data', current_row.data,
    'revision', current_row.revision, 'deleted_at', current_row.deleted_at
  );
end $$;

drop function if exists public.save_quote_cas(jsonb, bigint);
drop function if exists public.save_quote_cas(text, jsonb, bigint);
create or replace function public.save_quote_cas(
  p_store_id text,
  p_proposed jsonb,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_id text := nullif(p_proposed->>'id', '');
  target_code text := nullif(p_proposed->>'code', '');
  proposed_deleted_at timestamptz := nullif(p_proposed->>'deletedAt', '')::timestamptz;
  proposed_quote_date date := nullif(left(coalesce(p_proposed->>'quoteDate', ''), 10), '')::date;
  current_row public.quotes%rowtype;
begin
  if p_store_id is null or target_id is null or target_code is null then
    raise exception 'quote_store_id_and_code_required' using errcode = '22023';
  end if;

  if p_expected_revision is null then
    insert into public.quotes (
      id, store_id, code, customer_name, customer_phone, quote_date, status,
      total_vnd, data, deleted_at
    ) values (
      target_id,
      p_store_id,
      target_code,
      nullif(p_proposed->>'customerName', ''),
      nullif(p_proposed->>'customerPhone', ''),
      proposed_quote_date,
      nullif(p_proposed->>'status', ''),
      round(coalesce(nullif(p_proposed->>'roundedTotalVnd', '')::numeric,
                     nullif(p_proposed->>'totalVnd', '')::numeric, 0))::bigint,
      p_proposed,
      proposed_deleted_at
    )
    on conflict (store_id, id) do nothing
    returning * into current_row;

    if found then
      return jsonb_build_object(
        'status', 'applied', 'id', current_row.id, 'data', current_row.data,
        'revision', current_row.revision, 'deleted_at', current_row.deleted_at
      );
    end if;
  end if;

  update public.quotes
  set code = target_code,
      customer_name = nullif(p_proposed->>'customerName', ''),
      customer_phone = nullif(p_proposed->>'customerPhone', ''),
      quote_date = proposed_quote_date,
      status = nullif(p_proposed->>'status', ''),
      total_vnd = round(coalesce(nullif(p_proposed->>'roundedTotalVnd', '')::numeric,
                                 nullif(p_proposed->>'totalVnd', '')::numeric, 0))::bigint,
      data = p_proposed,
      deleted_at = proposed_deleted_at
  where id = target_id
    and store_id = p_store_id
    and revision = p_expected_revision
    and deleted_at is null
  returning * into current_row;

  if found then
    return jsonb_build_object(
      'status', 'applied', 'id', current_row.id, 'data', current_row.data,
      'revision', current_row.revision, 'deleted_at', current_row.deleted_at
    );
  end if;

  select * into current_row from public.quotes
  where id = target_id and store_id = p_store_id;
  if not found then
    return jsonb_build_object('status', 'missing');
  end if;
  return jsonb_build_object(
    'status', case when current_row.deleted_at is null then 'conflict' else 'deleted' end,
    'id', current_row.id, 'data', current_row.data,
    'revision', current_row.revision, 'deleted_at', current_row.deleted_at
  );
end $$;

revoke all on function public.current_store_ids() from public, anon;
revoke all on function public.current_store_manager_ids() from public, anon;
revoke all on function public.save_app_document_cas(text, text, bigint, jsonb) from public, anon;
revoke all on function public.set_product_order(text, text[]) from public, anon;
revoke all on function public.adjust_product_prices(text, double precision) from public, anon;
revoke all on function public.save_product_cas(text, jsonb, bigint) from public, anon;
revoke all on function public.save_quote_cas(text, jsonb, bigint) from public, anon;

grant execute on function public.current_store_ids() to authenticated;
grant execute on function public.current_store_manager_ids() to authenticated;
grant execute on function public.public_store_ids() to anon, authenticated;
grant execute on function public.save_app_document_cas(text, text, bigint, jsonb) to authenticated;
grant execute on function public.set_product_order(text, text[]) to authenticated;
grant execute on function public.adjust_product_prices(text, double precision) to authenticated;
grant execute on function public.save_product_cas(text, jsonb, bigint) to authenticated;
grant execute on function public.save_quote_cas(text, jsonb, bigint) to authenticated;

-- ---------- Realtime ----------
-- Realtime is the mechanism that lets another logged-in browser see edits
-- without manually pulling. The client subscribes to these publications.
-- RLS vẫn áp dụng: máy khác chỉ nhận thay đổi của cửa hàng mình.
do $$ begin
  alter publication supabase_realtime add table public.products;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.quotes;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.suggestions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.app_documents;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.store_members;
exception when duplicate_object then null; end $$;

-- ============================================================================
-- STORAGE (ảnh sản phẩm)
-- Bucket product-images (Public = ON) — URL ảnh công khai vẫn tải được, nhưng
-- anon không có policy SELECT nên không thể gọi API để liệt kê toàn bộ object.
--
-- CHƯA ĐÓNG KHUNG THEO CỬA HÀNG. Đây là lỗ hổng đã biết duy nhất còn lại của
-- mô hình đa cửa hàng: mọi tài khoản đã đăng nhập vẫn đọc/ghi được ảnh của
-- cửa hàng khác nếu biết đường dẫn. Siết bằng cách bắt đường dẫn object bắt
-- đầu bằng <store_id>/ — phải migrate đường dẫn ảnh hiện có trước, nếu không
-- toàn bộ ảnh đang dùng sẽ mất.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists product_images_write on storage.objects;
drop policy if exists product_images_authenticated_all on storage.objects;
create policy product_images_authenticated_all on storage.objects
  for all to authenticated
  using (bucket_id = 'product-images') with check (bucket_id = 'product-images');

-- Ảnh ghi đè riêng của báo giá có thể gắn với công trình/khách hàng, vì vậy
-- bucket này KHÔNG public. Client đăng nhập tải bằng Storage API rồi tạo blob URL.
insert into storage.buckets (id, name, public)
values ('quote-images', 'quote-images', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists quote_images_auth_all on storage.objects;
drop policy if exists quote_images_authenticated_all on storage.objects;
create policy quote_images_authenticated_all on storage.objects
  for all to authenticated
  using (bucket_id = 'quote-images') with check (bucket_id = 'quote-images');

-- PostgREST cache tên bảng/cột; nạp lại ngay sau khi chạy file này.
notify pgrst, 'reload schema';

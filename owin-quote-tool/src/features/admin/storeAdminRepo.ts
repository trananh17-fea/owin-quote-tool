/**
 * Đọc/ghi cho trang quản trị cửa hàng.
 *
 * RLS quyết định ai làm được gì: chủ/quản lý chỉ đụng được thành viên của cửa
 * hàng mình, Quản trị viên hệ thống mới duyệt được cửa hàng. Ở đây không tự
 * kiểm tra quyền lần nữa — làm vậy chỉ tạo ảo giác an toàn ở phía trình duyệt.
 */
import { supabase } from '@/services/supabase/client';
import type { MembershipStatus, StoreRole } from '@/features/auth/storeSession';

export interface StoreMemberRow {
  userId: string;
  email: string;
  displayName: string;
  role: StoreRole;
  status: MembershipStatus;
  createdAt: string;
}

export interface PendingStoreRow {
  id: string;
  name: string;
  slug: string | null;
  ownerEmail: string;
  ownerName: string;
  createdAt: string;
}

interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
}

/** store_members không có khoá ngoại tới profiles nên phải tra hồ sơ rời. */
async function readProfiles(userIds: readonly string[]): Promise<Map<string, ProfileRow>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,display_name')
    .in('id', unique);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((row) => [(row as ProfileRow).id, row as ProfileRow]));
}

function nameFor(profile: ProfileRow | undefined, email: string): string {
  return profile?.display_name?.trim() || email.split('@')[0] || 'Tài khoản';
}

export async function listStoreMembers(storeId: string): Promise<StoreMemberRow[]> {
  const { data, error } = await supabase
    .from('store_members')
    .select('user_id,role,status,created_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    user_id: string;
    role: StoreRole;
    status: MembershipStatus;
    created_at: string;
  }>;
  const profiles = await readProfiles(rows.map((row) => row.user_id));

  return rows.map((row) => {
    const profile = profiles.get(row.user_id);
    const email = profile?.email ?? '';
    return {
      userId: row.user_id,
      email,
      displayName: nameFor(profile, email),
      role: row.role,
      status: row.status,
      createdAt: row.created_at,
    };
  });
}

export async function setMemberStatus(
  storeId: string,
  userId: string,
  status: MembershipStatus,
): Promise<void> {
  const { error } = await supabase
    .from('store_members')
    .update({ status })
    .eq('store_id', storeId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function setMemberRole(
  storeId: string,
  userId: string,
  role: StoreRole,
): Promise<void> {
  const { error } = await supabase
    .from('store_members')
    .update({ role })
    .eq('store_id', storeId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

export async function removeMember(storeId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('store_members')
    .delete()
    .eq('store_id', storeId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/** Cửa hàng đang chờ Quản trị viên hệ thống duyệt. */
export async function listPendingStores(): Promise<PendingStoreRow[]> {
  const { data, error } = await supabase
    .from('stores')
    .select('id,name,slug,owner_id,created_at')
    .eq('status', 'pending')
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    id: string;
    name: string;
    slug: string | null;
    owner_id: string;
    created_at: string;
  }>;
  const profiles = await readProfiles(rows.map((row) => row.owner_id));

  return rows.map((row) => {
    const profile = profiles.get(row.owner_id);
    const ownerEmail = profile?.email ?? '';
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      ownerEmail,
      ownerName: nameFor(profile, ownerEmail),
      createdAt: row.created_at,
    };
  });
}

export async function setStoreStatus(
  storeId: string,
  status: 'active' | 'rejected',
): Promise<void> {
  const { error } = await supabase.from('stores').update({ status }).eq('id', storeId);
  if (error) throw new Error(error.message);
}

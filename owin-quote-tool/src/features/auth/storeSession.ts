/**
 * Xác định cửa hàng của tài khoản đang đăng nhập.
 *
 * Đăng nhập thành công CHƯA đủ để vào app: tài khoản còn phải là thành viên
 * `active` của ít nhất một cửa hàng. Người vừa đăng nhập Google lần đầu chưa
 * thuộc cửa hàng nào nên phải chờ chủ cửa hàng duyệt.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/services/supabase/client';
import { setCurrentStoreId } from '@/services/supabase/currentStore';

export type StoreRole = 'owner' | 'admin' | 'staff';
export type MembershipStatus = 'pending' | 'active' | 'disabled';

export interface StoreSummary {
  id: string;
  name: string;
  slug: string | null;
}

export type StoreAccess =
  /** Đang hỏi Supabase. */
  | { status: 'loading' }
  /** Có cửa hàng dùng được. */
  | { status: 'ready'; store: StoreSummary; stores: StoreSummary[]; role: StoreRole }
  /** Đã được thêm vào cửa hàng nhưng chưa được duyệt. */
  | { status: 'pending' }
  /** Tài khoản bị khoá ở mọi cửa hàng. */
  | { status: 'disabled' }
  /** Chưa thuộc cửa hàng nào. */
  | { status: 'none' }
  | { status: 'error'; message: string };

export interface MembershipRow {
  store_id: string;
  role: StoreRole;
  status: MembershipStatus;
}

/**
 * Quy ra quyền truy cập từ danh sách thành viên và cửa hàng đọc được.
 * Tách riêng khỏi phần gọi mạng để kiểm thử được từng nhánh trạng thái.
 */
export function resolveStoreAccess(
  memberships: readonly MembershipRow[],
  stores: readonly StoreSummary[],
  rememberedStoreId: string | null,
): StoreAccess {
  const active = memberships.filter((row) => row.status === 'active');

  if (active.length === 0) {
    if (memberships.some((row) => row.status === 'pending')) return { status: 'pending' };
    if (memberships.some((row) => row.status === 'disabled')) return { status: 'disabled' };
    return { status: 'none' };
  }

  // Cửa hàng bị xoá mềm không đọc được, nên tư cách thành viên còn lại cũng vô nghĩa.
  const usable = stores.filter((store) => active.some((row) => row.store_id === store.id));
  if (usable.length === 0) return { status: 'none' };

  const store = usable.find((candidate) => candidate.id === rememberedStoreId) ?? usable[0];
  const role = active.find((row) => row.store_id === store.id)?.role ?? 'staff';

  return { status: 'ready', store, stores: usable, role };
}

const LAST_STORE_KEY = 'owin-current-store';

/** Nhớ cửa hàng đã chọn để lần sau vào đúng chỗ. Hỏng storage thì bỏ qua. */
function readLastStoreId(): string | null {
  try {
    return localStorage.getItem(LAST_STORE_KEY);
  } catch {
    return null;
  }
}

function writeLastStoreId(storeId: string): void {
  try {
    localStorage.setItem(LAST_STORE_KEY, storeId);
  } catch {
    // Cửa sổ ẩn danh hoặc bị chặn storage: không nhớ được cũng không sao.
  }
}

export async function loadStoreAccess(userId: string): Promise<StoreAccess> {
  const { data: membershipRows, error: membershipError } = await supabase
    .from('store_members')
    .select('store_id,role,status')
    .eq('user_id', userId);

  if (membershipError) return { status: 'error', message: membershipError.message };

  const memberships = (membershipRows ?? []) as MembershipRow[];
  const active = memberships.filter((row) => row.status === 'active');
  if (active.length === 0) return resolveStoreAccess(memberships, [], null);

  const { data: storeRows, error: storeError } = await supabase
    .from('stores')
    .select('id,name,slug')
    .in('id', active.map((row) => row.store_id))
    .is('deleted_at', null)
    .order('name');

  if (storeError) return { status: 'error', message: storeError.message };

  return resolveStoreAccess(memberships, (storeRows ?? []) as StoreSummary[], readLastStoreId());
}

/**
 * Trạng thái cửa hàng cho một phiên đăng nhập. `reload` dùng sau khi được
 * duyệt để vào app mà không phải đăng xuất rồi đăng nhập lại.
 */
export function useStoreAccess(userId: string): {
  access: StoreAccess;
  reload: () => void;
} {
  const [access, setAccess] = useState<StoreAccess>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setAccess({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    setCurrentStoreId(null);

    loadStoreAccess(userId)
      .then((next) => {
        if (!active) return;
        // Đặt store TRƯỚC khi báo ready: repository đọc giá trị này ngay ở
        // lần render đầu của app, muộn một nhịp là ném lỗi thiếu cửa hàng.
        if (next.status === 'ready') {
          setCurrentStoreId(next.store.id);
          writeLastStoreId(next.store.id);
        }
        setAccess(next);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAccess({
          status: 'error',
          message: error instanceof Error ? error.message : 'Không đọc được thông tin cửa hàng.',
        });
      });

    return () => {
      active = false;
      // Đăng xuất rồi mà id cũ còn nằm lại thì tài khoản kế tiếp có thể ghi
      // nhầm sang cửa hàng của người trước.
      setCurrentStoreId(null);
    };
  }, [userId, attempt]);

  return { access, reload };
}

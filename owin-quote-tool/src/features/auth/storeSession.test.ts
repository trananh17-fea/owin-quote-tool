import { describe, expect, it } from 'vitest';
import { resolveStoreAccess } from '@/features/auth/storeSession';
import type { MembershipRow, StoreSummary } from '@/features/auth/storeSession';

const owinStore: StoreSummary = { id: 'owin', name: 'OWIN', slug: 'owin' };
const otherStore: StoreSummary = { id: 'other', name: 'Cửa hàng khác', slug: 'other' };

const membership = (
  store_id: string,
  status: MembershipRow['status'],
  role: MembershipRow['role'] = 'staff',
): MembershipRow => ({ store_id, status, role });

describe('resolveStoreAccess', () => {
  it('không cho vào khi tài khoản chưa thuộc cửa hàng nào', () => {
    expect(resolveStoreAccess([], [], null)).toEqual({ status: 'none' });
  });

  it('báo chờ duyệt khi mới được thêm vào cửa hàng', () => {
    const access = resolveStoreAccess([membership('owin', 'pending')], [], null);
    expect(access).toEqual({ status: 'pending' });
  });

  it('báo bị khoá khi mọi tư cách thành viên đều disabled', () => {
    const access = resolveStoreAccess([membership('owin', 'disabled')], [], null);
    expect(access).toEqual({ status: 'disabled' });
  });

  it('chờ duyệt được ưu tiên hơn bị khoá ở cửa hàng khác', () => {
    const access = resolveStoreAccess(
      [membership('other', 'disabled'), membership('owin', 'pending')],
      [],
      null,
    );
    expect(access).toEqual({ status: 'pending' });
  });

  it('mở cửa hàng và giữ đúng vai trò khi đã được duyệt', () => {
    const access = resolveStoreAccess(
      [membership('owin', 'active', 'owner')],
      [owinStore],
      null,
    );
    expect(access).toEqual({
      status: 'ready',
      store: owinStore,
      stores: [owinStore],
      role: 'owner',
      isPlatformAdmin: false,
    });
  });

  it('giữ cờ Quản trị viên hệ thống khi mở cửa hàng', () => {
    const access = resolveStoreAccess([membership('owin', 'active')], [owinStore], null, true);
    expect(access).toMatchObject({ status: 'ready', isPlatformAdmin: true });
  });

  it('quay lại cửa hàng đã dùng lần trước khi thuộc nhiều cửa hàng', () => {
    const access = resolveStoreAccess(
      [membership('owin', 'active'), membership('other', 'active', 'manager')],
      [owinStore, otherStore],
      'other',
    );
    expect(access).toMatchObject({ status: 'ready', store: otherStore, role: 'manager' });
  });

  it('lấy cửa hàng đầu tiên khi id đã nhớ không còn dùng được', () => {
    const access = resolveStoreAccess(
      [membership('owin', 'active')],
      [owinStore],
      'da-bi-xoa',
    );
    expect(access).toMatchObject({ status: 'ready', store: owinStore });
  });

  it('bỏ qua cửa hàng đã xoá mềm dù tư cách thành viên vẫn active', () => {
    const access = resolveStoreAccess([membership('owin', 'active')], [], null);
    expect(access).toEqual({ status: 'none' });
  });

  it('không trả về cửa hàng mà tài khoản chưa được duyệt', () => {
    const access = resolveStoreAccess(
      [membership('owin', 'active'), membership('other', 'pending')],
      [owinStore, otherStore],
      'other',
    );
    expect(access).toMatchObject({ status: 'ready', store: owinStore, stores: [owinStore] });
  });
});

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Clock, LogOut, RefreshCw, ShieldAlert, Store } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { signOut } from '@/features/auth/authSession';
import { useStoreAccess } from '@/features/auth/storeSession';
import './storeGate.css';

/** Màn chặn khi tài khoản đăng nhập được nhưng chưa dùng được cửa hàng nào. */
function StoreNotice({
  icon,
  title,
  children,
  onRetry,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  onRetry?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    setBusy(true);
    try { await signOut(); }
    finally { setBusy(false); }
  };

  return (
    <div className="store-gate">
      <div className="store-gate-card" role="status">
        <span className="store-gate-icon" aria-hidden="true">{icon}</span>
        <h1>{title}</h1>
        <div className="store-gate-body">{children}</div>
        <div className="store-gate-actions">
          {onRetry && (
            <button type="button" className="store-gate-retry" onClick={onRetry}>
              <RefreshCw size={17} /> Kiểm tra lại
            </button>
          )}
          <button type="button" className="store-gate-logout" onClick={logout} disabled={busy}>
            <LogOut size={17} /> Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Chặn giữa đăng nhập và app: chỉ thành viên `active` của một cửa hàng mới đi
 * tiếp. Cửa hàng đang làm việc được đặt xong trước khi children render, vì mọi
 * repository đều cần nó ngay từ lần đọc đầu tiên.
 */
export function StoreGate({ session, children }: { session: Session; children: ReactNode }) {
  const { access, reload } = useStoreAccess(session.user.id);
  const email = session.user.email ?? '';

  if (access.status === 'loading') {
    return (
      <div className="store-gate">
        <p className="store-gate-loading">Đang mở cửa hàng…</p>
      </div>
    );
  }

  if (access.status === 'pending') {
    return (
      <StoreNotice icon={<Clock size={26} />} title="Tài khoản đang chờ duyệt" onRetry={reload}>
        <p>
          Bạn đã đăng nhập bằng <strong>{email}</strong>, nhưng quản lý cửa hàng
          chưa duyệt tài khoản này.
        </p>
        <p>Nhắn cho quản lý để được duyệt, rồi bấm “Kiểm tra lại”.</p>
      </StoreNotice>
    );
  }

  if (access.status === 'none') {
    return (
      <StoreNotice icon={<Store size={26} />} title="Chưa có cửa hàng" onRetry={reload}>
        <p>
          Tài khoản <strong>{email}</strong> chưa thuộc cửa hàng nào nên chưa có
          dữ liệu để hiển thị.
        </p>
        <p>Gửi email này cho quản lý để được thêm vào cửa hàng.</p>
      </StoreNotice>
    );
  }

  if (access.status === 'disabled') {
    return (
      <StoreNotice icon={<ShieldAlert size={26} />} title="Tài khoản đã bị khoá">
        <p>
          Quyền truy cập của <strong>{email}</strong> đã bị khoá. Liên hệ quản lý
          cửa hàng nếu bạn cho rằng đây là nhầm lẫn.
        </p>
      </StoreNotice>
    );
  }

  if (access.status === 'error') {
    return (
      <StoreNotice icon={<ShieldAlert size={26} />} title="Không mở được cửa hàng" onRetry={reload}>
        <p>Không đọc được thông tin cửa hàng của tài khoản này.</p>
        <p className="store-gate-detail">{access.message}</p>
      </StoreNotice>
    );
  }

  return <>{children}</>;
}

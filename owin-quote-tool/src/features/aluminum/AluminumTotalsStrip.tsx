import { formatEstimatorMoney } from '@/lib/aluminumEstimator/estimator';

export type AutosavePhase = 'loading' | 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/** Nhãn trạng thái autosave; 'error' được vẽ riêng vì có nút thử lại. */
function autosaveLabelFor(phase: AutosavePhase, lastSavedAt: string | null): string | null {
  if (phase === 'loading') return 'Đang tải…';
  if (phase === 'idle') return 'Sẵn sàng';
  if (phase === 'pending') return 'Sắp lưu…';
  if (phase === 'saving') return 'Đang lưu…';
  if (phase === 'saved') return lastSavedAt ? 'Đã lưu' : 'Sẵn sàng';
  return null;
}

/** Dải tổng: tiền của hệ đang xem, tiền tất cả hệ và trạng thái lưu. */
export function AluminumTotalsStrip({
  systemName,
  systemTotalAmount,
  allTotalAmount,
  autosavePhase,
  lastSavedAt,
  onRetry,
}: {
  systemName: string;
  systemTotalAmount: number;
  allTotalAmount: number;
  autosavePhase: AutosavePhase;
  lastSavedAt: string | null;
  onRetry: () => void;
}) {
  const autosaveLabel = autosaveLabelFor(autosavePhase, lastSavedAt);

  return (
    <div className="aluminum-totals-strip">
      <div className="aluminum-total-chip">
        <span>Hệ {systemName}</span>
        <strong>{formatEstimatorMoney(systemTotalAmount)} đ</strong>
      </div>
      <div className="aluminum-total-chip aluminum-total-chip-all">
        <span>Tất cả hệ</span>
        <strong>{formatEstimatorMoney(allTotalAmount)} đ</strong>
      </div>
      <span className={`aluminum-autosave aluminum-autosave-${autosavePhase}`}>
        {autosavePhase === 'error' ? (
          <>
            Lỗi lưu.{' '}
            <button
              type="button"
              className="btn-link"
              onClick={onRetry}
            >
              Thử lại
            </button>
          </>
        ) : (
          autosaveLabel
        )}
      </span>
    </div>
  );
}

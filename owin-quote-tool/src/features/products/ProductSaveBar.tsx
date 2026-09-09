/** Trạng thái lưu tay của form sản phẩm (không auto-save). */
export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

const STATUS_TEXT: Record<Exclude<SaveStatus, 'error'>, string> = {
  idle: 'Nhập tên, rồi bấm Lưu.',
  dirty: 'Có thay đổi — bấm Lưu.',
  saving: 'Đang lưu…',
  saved: 'Đã lưu.',
};

/** Thanh dưới form: trạng thái lưu + nút Quay lại / Lưu. */
export function ProductSaveBar({
  status,
  error,
  saving,
  canSave,
  onSave,
  onBack,
}: {
  status: SaveStatus;
  error: string | null;
  saving: boolean;
  canSave: boolean;
  onSave: () => void;
  onBack: () => void;
}) {
  // 'dirty' hiển thị như trạng thái chờ lưu.
  const stateClass = status === 'dirty' ? 'pending' : status;

  return (
    <div className="toolbar product-editor-actions no-print">
      <div
        className={`product-autosave-status is-${stateClass}`}
        role={status === 'error' ? 'alert' : 'status'}
        aria-live="polite"
      >
        {status === 'error' ? (
          <>
            <span>Lỗi: {error}</span>
            <button type="button" className="btn-link" onClick={onSave}>Thử lại</button>
          </>
        ) : (
          STATUS_TEXT[status]
        )}
      </div>
      <div className="product-editor-action-btns">
        <button type="button" className="btn btn-ghost" onClick={onBack}>Quay lại</button>
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={!canSave || saving}>
          {saving ? 'Đang lưu…' : 'Lưu'}
        </button>
      </div>
    </div>
  );
}

import { ArrowLeft, FileDown, Save } from 'lucide-react';

/** Đầu form báo giá: nút quay lại, tiêu đề và hàng nút Báo giá mới / Lưu / Word / Excel / PDF. */
export function QuoteFormHeader({
  quoteId,
  loading,
  productCount,
  historyCount,
  itemCount,
  saving,
  onBack,
  onNew,
  onSave,
  onExportWord,
  onExportExcel,
  onExportPdf,
}: {
  quoteId: string | null;
  loading: boolean;
  productCount: number;
  historyCount: number;
  itemCount: number;
  saving: boolean;
  onBack: () => void;
  onNew: () => void;
  onSave: () => void;
  onExportWord: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
}) {
  return (
    <div className="toolbar quote-form-heading">
      <div className="quote-form-heading-main">
        <button className="admin-back-button" onClick={onBack} aria-label="Quay lại danh sách báo giá">
          <ArrowLeft size={20} />
        </button>
        <div className="quote-form-heading-text">
          <h1 className="app-title">{quoteId ? 'Cập nhật báo giá' : 'Thiết kế & Lập báo giá'}</h1>
          <p className="app-subtitle">
            {loading ? 'Đang tải kho…' : `${productCount} sản phẩm · ${historyCount} báo giá đã lưu`}
          </p>
        </div>
      </div>
      <div className="quote-form-actions no-print">
        <button className="btn btn-ghost" disabled={saving} onClick={onNew}>Báo giá mới</button>
        <button className="btn btn-primary" disabled={itemCount === 0 || saving} onClick={onSave}>
          <Save size={17} style={{ verticalAlign: '-3px' }} /> {saving ? 'Đang lưu…' : 'Lưu'}
        </button>
        <button className="btn btn-ghost" disabled={itemCount === 0 || saving} onClick={onExportWord}>
          <FileDown size={17} style={{ verticalAlign: '-3px' }} /> Word
        </button>
        <button className="btn btn-ghost" disabled={itemCount === 0 || saving} onClick={onExportExcel}>
          <FileDown size={17} style={{ verticalAlign: '-3px' }} /> Excel
        </button>
        <button className="btn btn-ghost" disabled={itemCount === 0 || saving} onClick={onExportPdf}>
          <FileDown size={17} style={{ verticalAlign: '-3px' }} /> PDF
        </button>
      </div>
    </div>
  );
}

import { FileDown } from 'lucide-react';

/**
 * Header của tab Bảng giá. Dùng đúng bố cục heading của tab Sản phẩm và Báo giá
 * (`.admin-page-heading` + hàng tiêu đề có chip đếm + phụ đề), phần hành động là
 * bộ lọc loại cửa và ba nút xuất file.
 */
export function CatalogueToolbar({
  loading,
  totalCount,
  shownCount,
  exportCategory,
  onExportCategoryChange,
  categories,
  exporting,
  exportingExcel,
  exportingPdf,
  onExportWord,
  onExportExcel,
  onExportPdf,
}: {
  loading: boolean;
  totalCount: number;
  shownCount: number;
  exportCategory: string;
  onExportCategoryChange: (value: string) => void;
  categories: string[];
  exporting: boolean;
  exportingExcel: boolean;
  exportingPdf: boolean;
  onExportWord: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
}) {
  const filtered = exportCategory !== 'all';
  return (
    <div className="admin-page-heading catalogue-list-heading no-print">
      <div className="catalogue-heading-text">
        <div className="catalogue-list-title-row">
          <h1 className="app-title">Bảng giá</h1>
          <span className="catalogue-list-count">
            {loading ? 'Đang tải…' : `${filtered ? shownCount : totalCount} sản phẩm`}
          </span>
        </div>
        <p className="app-subtitle">
          {filtered ? `Bảng giá nhôm kính hệ OWIN · ${exportCategory}` : 'Bảng giá sản phẩm nhôm kính hệ OWIN'}
        </p>
      </div>
      <div className="catalogue-heading-actions">
        <label className="catalogue-filter-label">
          <span>Xuất theo</span>
          <select
            className="input"
            value={exportCategory}
            onChange={(e) => onExportCategoryChange(e.target.value)}
          >
            <option value="all">Tất cả</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="catalogue-export-actions">
          <button
            className="btn btn-ghost"
            disabled={shownCount === 0 || exporting}
            onClick={onExportWord}
          >
            <FileDown size={17} style={{ verticalAlign: '-3px' }} /> {exporting ? '…' : 'Word'}
          </button>
          <button
            className="btn btn-ghost"
            disabled={shownCount === 0 || exportingExcel}
            onClick={onExportExcel}
          >
            <FileDown size={17} style={{ verticalAlign: '-3px' }} /> {exportingExcel ? '…' : 'Excel'}
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={shownCount === 0 || exportingPdf}
            onClick={onExportPdf}
            title="Tải file PDF (không mở hộp thoại in)"
          >
            <FileDown size={17} style={{ verticalAlign: '-3px' }} /> {exportingPdf ? 'Đang xuất…' : 'PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

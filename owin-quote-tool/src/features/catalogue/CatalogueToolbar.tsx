import { FileDown } from 'lucide-react';

/** Thanh công cụ của tab Bảng giá: tiêu đề, lọc theo loại cửa, ba nút xuất file. */
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
  return (
    <div className="toolbar catalogue-toolbar no-print">
      <div className="catalogue-toolbar-text">
        <h1 className="app-title">Bảng giá</h1>
        <p className="app-subtitle">
          {loading
            ? 'Đang tải…'
            : exportCategory === 'all'
              ? `${totalCount} sản phẩm`
              : `${shownCount} SP · ${exportCategory}`}
        </p>
      </div>
      <div className="catalogue-toolbar-actions">
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

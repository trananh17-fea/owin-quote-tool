import { Copy, Eye, FileDown, LoaderCircle, Plus, Search, Trash2 } from 'lucide-react';
import type { QuoteRecord } from '@/types/models';
import { formatVND } from '@/lib/format/currency';
import { formatShortDate, statusLabel } from '@/features/quote/quoteFormat';

/** Màn danh sách báo giá: ô lọc, bảng lịch sử và các trạng thái rỗng / đang tải. */
export function QuoteListPanel({
  history,
  filteredHistory,
  quoteSearch,
  quoteStatusFilter,
  message,
  loading,
  error,
  onSearch,
  onStatusFilter,
  onCreate,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  onRetry,
}: {
  history: QuoteRecord[];
  filteredHistory: QuoteRecord[];
  quoteSearch: string;
  quoteStatusFilter: QuoteRecord['status'] | '';
  message: string;
  loading: boolean;
  error: string;
  onSearch: (value: string) => void;
  onStatusFilter: (value: QuoteRecord['status'] | '') => void;
  onCreate: () => void;
  onView: (quote: QuoteRecord) => void;
  onEdit: (quote: QuoteRecord) => void;
  onDuplicate: (quote: QuoteRecord) => void;
  onDelete: (quote: QuoteRecord) => void;
  onRetry: () => void;
}) {
  return (
    <section className="admin-page quote-list-page">
      <div className="admin-page-heading">
        <div>
          <h1 className="app-title">Danh sách báo giá</h1>
          <p className="app-subtitle">Hồ sơ báo giá chi tiết nhôm kính hệ OWIN · {history.length} báo giá</p>
        </div>
        <div className="product-header-actions">
          <button className="btn btn-primary" onClick={onCreate}>
            <Plus size={18} style={{ verticalAlign: '-3px' }} /> Tạo báo giá mới
          </button>
        </div>
      </div>

      {message && <div className="product-toast">{message}</div>}
      {error && (
        <div className="product-data-error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-ghost" onClick={onRetry}>Thử tải lại</button>
        </div>
      )}

      <div className="product-filter-card">
        <div className="field product-filter-search">
          <label><Search size={15} style={{ verticalAlign: '-2px' }} /> Tìm báo giá</label>
          <input
            className="input"
            value={quoteSearch}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Tìm theo mã báo giá, tên khách, sđt..."
          />
        </div>
        <div className="field">
          <label>Trạng thái</label>
          <select
            className="input"
            value={quoteStatusFilter}
            onChange={(event) => onStatusFilter(event.target.value as QuoteRecord['status'] | '')}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="DRAFT">Nháp</option>
            <option value="SAVED">Đã lưu</option>
            <option value="EXPORTED">Đã xuất</option>
          </select>
        </div>
      </div>

      <div className="quote-history-table-wrap quote-list-table-card">
        {loading ? (
          <div className="product-empty-card"><LoaderCircle className="spin" size={32} /><p>Đang tải báo giá từ Supabase…</p></div>
        ) : history.length === 0 ? (
          <div className="product-empty-card">
            <FileDown size={44} />
            <h3>Chưa có báo giá</h3>
            <p>Tạo báo giá mới để bắt đầu lưu lịch sử.</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="product-empty-card">
            <Search size={44} />
            <h3>Không tìm thấy báo giá</h3>
            <p>Thử đổi từ khóa hoặc trạng thái lọc.</p>
          </div>
        ) : (
          <table className="quote-history-table">
            <thead>
              <tr>
                <th>Mã báo giá</th>
                <th>Khách hàng</th>
                <th>Giá trị nhôm</th>
                <th>Phụ kiện</th>
                <th>Tổng cộng</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((quote) => (
                <tr key={quote.id} className="quote-history-row">
                  <td data-col="code">
                    <button className="quote-code-button" onClick={() => onView(quote)}>
                      {quote.code}
                    </button>
                    <div className="quote-history-mobile-date">{formatShortDate(quote.createdAt)}</div>
                  </td>
                  <td data-col="customer">
                    <div className="quote-customer-name">{quote.customerName || 'Khách chưa đặt tên'}</div>
                    <div className="quote-customer-meta">{quote.customerPhone || quote.customerAddress || ''}</div>
                  </td>
                  <td className="num" data-col="product">{formatVND(quote.subtotalProductVnd)}</td>
                  <td className="num" data-col="accessory">{formatVND(quote.subtotalAccessoryVnd)}</td>
                  <td className="num total-cell" data-col="total">{formatVND(quote.roundedTotalVnd)}</td>
                  <td data-col="status"><span className={`quote-status-pill quote-status-${quote.status.toLowerCase()}`}>{statusLabel(quote.status)}</span></td>
                  <td data-col="date">{formatShortDate(quote.createdAt)}</td>
                  <td data-col="actions">
                    <div className="quote-actions">
                      <button className="icon-btn" onClick={() => onView(quote)} aria-label="Xem báo giá">
                        <Eye size={16} />
                      </button>
                      <button className="btn btn-ghost" onClick={() => onEdit(quote)}>Sửa</button>
                      <button className="icon-btn" onClick={() => onDuplicate(quote)} aria-label="Nhân bản">
                        <Copy size={16} />
                      </button>
                      <button className="icon-btn danger" onClick={() => onDelete(quote)} aria-label="Xoá báo giá">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

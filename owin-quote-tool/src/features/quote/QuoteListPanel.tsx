import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy, FileDown, ListFilter, LoaderCircle, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { QuoteRecord } from '@/types/models';
import { formatVND } from '@/lib/format/currency';
import { formatShortDate, statusLabel } from '@/features/quote/quoteFormat';
import { paginateItems, type QuotePageSize } from '@/features/quote/quotePagination';

const QUOTE_PAGE_SIZES: QuotePageSize[] = [25, 50, 100];

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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<QuotePageSize>(25);
  const pagination = useMemo(
    () => paginateItems(filteredHistory, currentPage, pageSize),
    [currentPage, filteredHistory, pageSize],
  );

  const handleSearch = (value: string) => {
    setCurrentPage(1);
    onSearch(value);
  };

  const handleStatusFilter = (value: QuoteRecord['status'] | '') => {
    setCurrentPage(1);
    onStatusFilter(value);
  };

  return (
    <section className="admin-page quote-list-page">
      <div className="admin-page-heading quote-list-heading">
        <div>
          <div className="quote-list-title-row">
            <h1 className="app-title">Danh sách báo giá</h1>
            <span className="quote-list-count">{history.length} báo giá</span>
          </div>
          <p className="app-subtitle">Hồ sơ báo giá chi tiết nhôm kính hệ OWIN</p>
        </div>
      </div>

      {message && <div className="toast">{message}</div>}
      {error && (
        <div className="data-error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-ghost" onClick={onRetry}>Thử tải lại</button>
        </div>
      )}

      <div className="quote-list-toolbar" role="search" aria-label="Tìm và lọc báo giá">
        <div className="quote-toolbar-control quote-toolbar-search">
          <Search size={18} aria-hidden="true" />
          <label className="quote-toolbar-label" htmlFor="quote-search">Tìm báo giá</label>
          <input
            id="quote-search"
            className="input"
            value={quoteSearch}
            onChange={(event) => handleSearch(event.target.value)}
            placeholder="Tìm theo mã báo giá, tên khách, sđt..."
          />
        </div>
        <div className="quote-toolbar-control quote-toolbar-status">
          <ListFilter size={18} aria-hidden="true" />
          <label className="quote-toolbar-label" htmlFor="quote-status">Lọc theo trạng thái</label>
          <select
            id="quote-status"
            className="input"
            value={quoteStatusFilter}
            onChange={(event) => handleStatusFilter(event.target.value as QuoteRecord['status'] | '')}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="DRAFT">Nháp</option>
            <option value="SAVED">Đã lưu</option>
            <option value="EXPORTED">Đã xuất</option>
          </select>
        </div>
        <button type="button" className="btn btn-primary quote-create-button" onClick={onCreate}>
          <Plus size={18} aria-hidden="true" />
          Tạo báo giá mới
        </button>
      </div>

      <div className="quote-history-table-wrap quote-list-table-card">
        {loading ? (
          <div className="empty-card"><LoaderCircle className="spin" size={32} /><p>Đang tải báo giá từ Supabase…</p></div>
        ) : history.length === 0 ? (
          <div className="empty-card">
            <FileDown size={44} />
            <h3>Chưa có báo giá</h3>
            <p>Tạo báo giá mới để bắt đầu lưu lịch sử.</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="empty-card">
            <Search size={44} />
            <h3>Không tìm thấy báo giá</h3>
            <p>Thử đổi từ khóa hoặc trạng thái lọc.</p>
          </div>
        ) : (
          <>
            <table className="quote-history-table">
              <thead>
                <tr>
                  <th scope="col" data-col="code">Mã báo giá</th>
                  <th scope="col" data-col="customer">Khách hàng</th>
                  <th scope="col" data-col="product">Giá trị nhôm</th>
                  <th scope="col" data-col="accessory">Phụ kiện</th>
                  <th scope="col" data-col="total">Tổng cộng</th>
                  <th scope="col" data-col="status">Trạng thái</th>
                  <th scope="col" data-col="date">Ngày tạo</th>
                  <th scope="col" data-col="actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pagination.items.map((quote) => (
                  <tr
                    key={quote.id}
                    className="quote-history-row"
                    tabIndex={0}
                    aria-label={`Xem chi tiết báo giá ${quote.code}`}
                    onClick={() => onView(quote)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onView(quote);
                      }
                    }}
                  >
                    <td data-col="code">
                      <button
                        className="quote-code-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onView(quote);
                        }}
                      >
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
                        <button
                          className="icon-btn quote-edit-action"
                          onClick={(event) => {
                            event.stopPropagation();
                            onEdit(quote);
                          }}
                          aria-label="Sửa báo giá"
                          title="Sửa báo giá"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-btn quote-copy-action"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDuplicate(quote);
                          }}
                          aria-label="Nhân bản"
                          title="Nhân bản"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          className="icon-btn danger quote-delete-action"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDelete(quote);
                          }}
                          aria-label="Xoá báo giá"
                          title="Xoá báo giá"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <nav className="quote-list-pagination" aria-label="Phân trang danh sách báo giá">
              <div className="quote-pagination-summary">
                <span>
                  Hiển thị {pagination.firstItemNumber}–{pagination.lastItemNumber} / {pagination.totalItems} báo giá
                </span>
                <label>
                  Mỗi trang
                  <select
                    className="input quote-page-size-select"
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value) as QuotePageSize);
                      setCurrentPage(1);
                    }}
                    aria-label="Số báo giá mỗi trang"
                  >
                    {QUOTE_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>
              </div>
              <div className="quote-pagination-controls">
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setCurrentPage(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  aria-label="Trang trước"
                >
                  <ChevronLeft size={17} />
                </button>
                <span aria-live="polite">Trang <strong>{pagination.page}</strong> / {pagination.totalPages}</span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setCurrentPage(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  aria-label="Trang sau"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </nav>
          </>
        )}
      </div>
    </section>
  );
}

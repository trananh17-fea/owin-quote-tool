import { ArrowLeft, Copy, FileDown } from 'lucide-react';
import type { ProductRecord, QuoteRecord } from '@/types/models';
import { formatVND } from '@/lib/format/currency';
import { ProductThumb } from '@/components/ProductThumb';
import { formatShortDate, statusLabel } from '@/features/quote/quoteFormat';
import { TotalLine } from '@/features/quote/QuoteFormPrimitives';
import { QuotePrintDocument } from '@/features/quote/QuotePrintDocument';

/** Màn chi tiết một báo giá đã lưu: thông tin, tổng quan, hạng mục snapshot và bảng in ẩn. */
export function QuoteDetailPanel({
  quote,
  products,
  saving,
  message,
  error,
  onBack,
  onEdit,
  onDuplicate,
  onDelete,
  onExport,
  onExportExcel,
  onExportPdf,
}: {
  quote: QuoteRecord;
  products: ProductRecord[];
  saving: boolean;
  message: string;
  error: string;
  onBack: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
}) {
  return (
    <section className="admin-page quote-detail-page">
      <div className="admin-page-heading">
        <div className="title-row">
          <button className="admin-back-button" onClick={onBack} aria-label="Quay lại danh sách báo giá">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="app-title">{quote.code}</h1>
            <p className="app-subtitle">{quote.customerName || 'Khách chưa đặt tên'} · {formatShortDate(quote.createdAt)}</p>
          </div>
        </div>
        <div className="quote-detail-actions">
          <button className="btn btn-ghost" onClick={onEdit}>Sửa</button>
          <button className="btn btn-ghost" onClick={onDuplicate}>
            <Copy size={16} style={{ verticalAlign: '-3px' }} /> Nhân bản
          </button>
          <button className="btn btn-ghost" disabled={saving} onClick={onExport}>
            <FileDown size={16} style={{ verticalAlign: '-3px' }} /> Word
          </button>
          <button className="btn btn-ghost" disabled={saving} onClick={onExportExcel}>
            <FileDown size={16} style={{ verticalAlign: '-3px' }} /> Excel
          </button>
          <button className="btn btn-ghost" disabled={saving} onClick={onExportPdf}>
            <FileDown size={16} style={{ verticalAlign: '-3px' }} /> PDF
          </button>
          <button className="btn btn-danger" onClick={onDelete}>Xóa</button>
        </div>
      </div>

      {message && (
        <div className="product-toast" style={error ? { color: 'var(--ios-red)' } : undefined}>
          {message}
        </div>
      )}

      <div className="quote-detail-grid">
        <section className="card">
          <div className="section-label">Thông tin khách hàng</div>
          <div className="quote-detail-info">
            <div><span>Khách hàng</span><strong>{quote.customerName || '—'}</strong></div>
            <div><span>SĐT</span><strong>{quote.customerPhone || '—'}</strong></div>
            <div><span>Email</span><strong>{quote.customerEmail || '—'}</strong></div>
            <div><span>Địa chỉ</span><strong>{quote.customerAddress || '—'}</strong></div>
            <div><span>Ngày báo giá</span><strong>{formatShortDate(quote.quoteDate || quote.createdAt)}</strong></div>
            <div><span>Trạng thái</span><strong>{statusLabel(quote.status)}</strong></div>
          </div>
        </section>
        <section className="card">
          <div className="section-label">Tổng quan giá trị đơn hàng</div>
          <TotalLine label="Sản phẩm chính" value={quote.subtotalProductVnd} />
          <TotalLine label="Phụ kiện lắp đặt" value={quote.subtotalAccessoryVnd} />
          <TotalLine label="Tổng tiền" value={quote.totalVnd} />
          <TotalLine label="Làm tròn" value={quote.roundedTotalVnd} strong />
          <TotalLine label="Tạm ứng" value={quote.depositVnd} />
          <TotalLine label="Cần thanh toán" value={quote.balanceVnd} strong />
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="section-label">Hạng mục báo giá ({quote.snapshot.items.length})</div>
        <div className="quote-detail-items">
          {quote.snapshot.items.map((item) => (
            <div key={`${item.quoteItemCode}-${item.sortOrder}`} className="quote-detail-item">
              <ProductThumb item={item} products={products} imagePath={item.coverImagePath || item.image || null} />
              <div>
                <div className="product-name">{item.quoteItemCode} · {item.itemName}</div>
                <div className="product-sub">
                  {item.category || item.groupName || '—'} · {formatVND(item.productSubtotalVnd)} · PK {formatVND(item.accessorySubtotalVnd)}
                </div>
              </div>
              <strong>{formatVND(item.itemTotalVnd)}</strong>
            </div>
          ))}
        </div>
      </section>

      <QuotePrintDocument quote={quote.snapshot} products={products} />
    </section>
  );
}

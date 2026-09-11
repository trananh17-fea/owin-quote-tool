import type { QuoteRecord } from '@/types/models';
import type { calculateQuote } from '@/lib/quote/quoteCalculator';
import { CurrencyInput } from '@/components/CurrencyInput';
import { Field, SaveFeedback, TotalLine } from '@/features/quote/QuoteFormPrimitives';
import type { SaveUiState } from '@/features/quote/QuoteFormPrimitives';

/** Hai thẻ đầu form: thông tin khách hàng (kèm trạng thái lưu) và bảng tổng tiền. */
export function QuoteFormTopGrid({
  customerName,
  customerPhone,
  customerEmail,
  customerAddress,
  quoteDate,
  depositVnd,
  quoteCode,
  status,
  suggestions,
  saveUiState,
  saveError,
  message,
  summary,
  onCustomerName,
  onCustomerPhone,
  onCustomerEmail,
  onCustomerAddress,
  onQuoteDate,
  onDeposit,
  onRetrySave,
}: {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  quoteDate: string;
  depositVnd: number;
  quoteCode: string;
  status: QuoteRecord['status'];
  suggestions: Record<string, string[]>;
  saveUiState: SaveUiState;
  saveError: string;
  message: string;
  summary: ReturnType<typeof calculateQuote>['summary'];
  onCustomerName: (value: string) => void;
  onCustomerPhone: (value: string) => void;
  onCustomerEmail: (value: string) => void;
  onCustomerAddress: (value: string) => void;
  onQuoteDate: (value: string) => void;
  onDeposit: (value: number) => void;
  onRetrySave: () => void;
}) {
  return (
    <div className="two-col quote-top-grid">
      <div className="card">
        <div className="section-label">Thông tin khách hàng</div>
        <div className="two-col quote-customer-grid">
          <Field label="Tên khách" value={customerName} onChange={onCustomerName} suggestions={suggestions.customer_name} />
          <Field label="SĐT" value={customerPhone} onChange={onCustomerPhone} />
          <Field label="Email" value={customerEmail} onChange={onCustomerEmail} />
          <Field label="Địa chỉ" value={customerAddress} onChange={onCustomerAddress} suggestions={suggestions.customer_address} />
          <div className="field">
            <label>Ngày báo giá</label>
            <input className="input" type="date" value={quoteDate} onChange={(e) => onQuoteDate(e.target.value)} />
          </div>
          <div className="field">
            <label>Tạm ứng</label>
            <CurrencyInput value={depositVnd} onChange={onDeposit} placeholder="0" />
          </div>
        </div>
        <div className="product-sub">
          {quoteCode || 'Chưa có mã'} · Trạng thái: {status}
        </div>
        <SaveFeedback
          state={saveUiState}
          error={saveError}
          onRetry={onRetrySave}
        />
        {message && !saveError && <div className="product-sub" style={{ color: 'var(--ios-green)' }}>{message}</div>}
      </div>

      <div className="card quote-totals-card">
        <div className="section-label">Tổng tiền</div>
        <TotalLine label="Tiền sản phẩm" value={summary.subtotalProductVnd} />
        <TotalLine label="Tiền phụ kiện" value={summary.subtotalAccessoryVnd} />
        <TotalLine label="Tổng trước làm tròn" value={summary.totalVnd} />
        <TotalLine label="Làm tròn xuống" value={summary.roundedTotalVnd} strong />
        <TotalLine label="Cần thanh toán" value={summary.balanceVnd} strong />
      </div>
    </div>
  );
}

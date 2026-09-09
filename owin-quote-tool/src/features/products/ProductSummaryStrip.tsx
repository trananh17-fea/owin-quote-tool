import { formatVND } from '@/lib/format/currency';

function SummaryMetric({ label, value, note, strong }: { label: string; value: string; note?: string; strong?: boolean }) {
  return (
    <div className={strong ? 'summary-metric summary-metric-strong' : 'summary-metric'}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

/**
 * Dải tổng ước tính của sản phẩm mẫu. Chỉ hiển thị — các con số do ProductForm
 * tính, công thức nằm ở productDraft.ts.
 */
export function ProductSummaryStrip({
  sampleProductTotal,
  fixedPackageTotal,
  extraAccessoriesTotal,
  estimatedTotal,
  sampleQuantityLabel,
}: {
  sampleProductTotal: number;
  fixedPackageTotal: number;
  extraAccessoriesTotal: number;
  estimatedTotal: number;
  sampleQuantityLabel: string;
}) {
  return (
    <div className="product-summary-strip">
      <SummaryMetric
        label="Giá sản phẩm mẫu"
        value={formatVND(sampleProductTotal)}
        note={sampleQuantityLabel}
      />
      <SummaryMetric label="Giá phụ kiện mẫu" value={formatVND(fixedPackageTotal)} />
      <SummaryMetric label="Phụ kiện phát sinh" value={formatVND(extraAccessoriesTotal)} />
      <SummaryMetric label="Tổng cộng ước tính" value={formatVND(estimatedTotal)} strong />
    </div>
  );
}

import { openImageLightbox } from '@/components/imageLightboxStore';
import { SmartNumberInput } from '@/components/SmartNumberInput';
import { parseSmartNumber } from '@/lib/format/smartNumber';
import { formatEstimatorMoney, parseEstimatorNumber } from '@/lib/aluminumEstimator/estimator';
import { getAluminumProfileImageDisplay } from '@/lib/aluminumEstimator/profileImage';
import type { AluminumEstimatorRowPatch } from '@/features/aluminum/aluminumEstimatorStorage';
import type { AluminumEstimatorRowViewModel } from '@/features/aluminum/aluminumRowModel';

/** Danh sách cây nhôm: bảng cho desktop, thẻ cho điện thoại (đổi theo breakpoint trong aluminum.css). */
export function AluminumTable({
  rows,
  onRowChange,
}: {
  rows: AluminumEstimatorRowViewModel[];
  onRowChange: (rowId: string, patch: AluminumEstimatorRowPatch) => void;
}) {
  const renderInput = (
    rowId: string,
    key: 'quantity' | 'unitPrice',
    value: string,
    label: string,
    className: string,
  ) => {
    const numeric = parseSmartNumber(value, {
      mode: key === 'quantity' ? 'int' : 'currency',
      min: 0,
    });
    return (
      <SmartNumberInput
        aria-label={label}
        className={className}
        mode={key === 'quantity' ? 'int' : 'currency'}
        min={0}
        value={numeric}
        onChange={(n) => {
          // Lưu chuỗi: 0 → "" để ô trống, gõ tiếp được; còn lại số thuần.
          onRowChange(rowId, { [key]: n === 0 ? '' : String(n) });
        }}
        placeholder="0"
      />
    );
  };

  const renderImage = (source: AluminumEstimatorRowViewModel['source']) => {
    const image = getAluminumProfileImageDisplay(source.image);
    return (
      <div className="aluminum-image-cell">
        {image.kind === 'image' ? (
          <img
            src={image.src}
            alt={`Hình ${source.code}`}
            style={{ cursor: 'zoom-in' }}
            onClick={() => openImageLightbox(image.src)}
          />
        ) : (
          <span>{image.label}</span>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Desktop / tablet ngang: bảng */}
      <div className="aluminum-table-wrap aluminum-table-desktop">
        <table className="aluminum-table aluminum-table-compact">
          <thead>
            <tr>
              <th>Hình</th>
              <th>Mã cây</th>
              <th>Mô tả</th>
              <th>SL</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ source, input, calculated }) => {
              const isActive = calculated.quantity > 0 || parseEstimatorNumber(input.unitPrice) > 0;
              const lineTotalText = calculated.lineTotal > 0
                ? `${formatEstimatorMoney(calculated.lineTotal)} đ`
                : '—';

              return (
                <tr key={source.rowId} className={isActive ? 'active' : ''}>
                  <td>{renderImage(source)}</td>
                  <td className="code">{source.code}</td>
                  <td className="description">{source.description}</td>
                  <td className="input-cell center">
                    {renderInput(source.rowId, 'quantity', input.quantity, `SL cây ${source.code}`, 'aluminum-qty-input')}
                  </td>
                  <td className="input-cell num">
                    {renderInput(source.rowId, 'unitPrice', input.unitPrice, `Đơn giá ${source.code}`, 'aluminum-price-input')}
                  </td>
                  <td className={calculated.lineTotal > 0 ? 'num total' : 'num muted'}>{lineTotalText}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Điện thoại: thẻ gọn, không cuộn ngang */}
      <div className="aluminum-card-list" aria-label="Danh sách cây nhôm">
        {rows.map(({ source, input, calculated }) => {
          const isActive = calculated.quantity > 0 || parseEstimatorNumber(input.unitPrice) > 0;
          const lineTotalText = calculated.lineTotal > 0
            ? `${formatEstimatorMoney(calculated.lineTotal)} đ`
            : '—';

          return (
            <article
              key={source.rowId}
              className={`aluminum-card${isActive ? ' active' : ''}`}
            >
              <div className="aluminum-card-top">
                {renderImage(source)}
                <div className="aluminum-card-meta">
                  <strong className="aluminum-card-code">{source.code}</strong>
                  <span className="aluminum-card-desc">{source.description}</span>
                </div>
              </div>
              <div className="aluminum-card-fields">
                <label className="aluminum-card-field">
                  <span>SL</span>
                  {renderInput(source.rowId, 'quantity', input.quantity, `SL cây ${source.code}`, 'aluminum-qty-input')}
                </label>
                <label className="aluminum-card-field aluminum-card-field-price">
                  <span>Đơn giá</span>
                  {renderInput(source.rowId, 'unitPrice', input.unitPrice, `Đơn giá ${source.code}`, 'aluminum-price-input')}
                </label>
                <div className="aluminum-card-field aluminum-card-total">
                  <span>Thành tiền</span>
                  <strong className={calculated.lineTotal > 0 ? 'total' : 'muted'}>{lineTotalText}</strong>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

/**
 * Các phép cập nhật state của trang "Tính nhôm" viết dưới dạng hàm thuần
 * (state hiện tại → state mới) để view chỉ còn việc gọi setState và để test
 * khoá được công thức quy đổi mốc màu.
 *
 * Thân hàm giữ nguyên từng ký tự so với bản cũ nằm trong AluminumEstimatorView.
 */
import {
  applyLinkedUnitPrice,
  convertAluminumUnitPrice,
  DEFAULT_COLOR_BASE_RATES,
  normalizeAluminumColor,
  normalizeColorBaseRates,
  recomputeLinkedPricesFromBases,
  scaleUnitPricesByGhiBaseChange,
  touchAluminumEstimatorState,
  type AluminumColor,
  type AluminumEstimatorPageState,
  type AluminumEstimatorRowPatch,
} from '@/features/aluminum/aluminumEstimatorStorage';

/** Ghi SL / đơn giá / note cho một dòng của hệ đang chọn. */
export function applyAluminumRowPatch(
  current: AluminumEstimatorPageState,
  systemId: string,
  rowId: string,
  patch: AluminumEstimatorRowPatch,
): AluminumEstimatorPageState {
  let next: AluminumEstimatorPageState = current;

  // SL chỉ session — không touch updatedAt, không kích hoạt lưu.
  if (patch.quantity !== undefined) {
    const systemQty = { ...(current.quantities[systemId] ?? {}) };
    if (!patch.quantity) delete systemQty[rowId];
    else systemQty[rowId] = patch.quantity;
    const quantities = { ...current.quantities };
    if (Object.keys(systemQty).length === 0) delete quantities[systemId];
    else quantities[systemId] = systemQty;
    next = { ...next, quantities };
  }

  // Đơn giá / note — quy đổi Ghi ↔ Vân gỗ theo mốc (2 ô dưới chip màu).
  if (patch.unitPrice !== undefined || patch.note !== undefined) {
    const color = normalizeAluminumColor(current.color);
    const prev = current.unitPricesByColor[color]?.[systemId]?.[rowId];
    const unitPrice = patch.unitPrice !== undefined ? patch.unitPrice : (prev?.unitPrice ?? '');
    const note = patch.note !== undefined ? patch.note : (prev?.note ?? '');
    const colorBaseRates = normalizeColorBaseRates(current.colorBaseRates);
    const unitPricesByColor = applyLinkedUnitPrice(
      current.unitPricesByColor,
      color,
      systemId,
      rowId,
      unitPrice,
      note,
      colorBaseRates,
    );
    next = touchAluminumEstimatorState({
      ...next,
      color,
      colorBaseRates,
      unitPricesByColor,
    });
  }

  return next;
}

/** Đổi mốc quy đổi của một màu (2 ô số dưới chip màu). */
export function applyAluminumBaseRate(
  current: AluminumEstimatorPageState,
  color: AluminumColor,
  raw: number,
): AluminumEstimatorPageState {
  const rates = normalizeColorBaseRates(current.colorBaseRates);
  const fallback = DEFAULT_COLOR_BASE_RATES[color];
  const value = Number.isFinite(raw) && raw > 0 ? Math.round(raw) : fallback;
  if (value === rates[color]) return current;

  if (color === 'Ghi - Cafe') {
    // Đổi mốc Ghi: mọi đơn giá (Ghi + Vân) = cũ / mốcGhiCũ × mốcGhiMới
    // Mốc Vân cũng scale cùng tỷ lệ để cặp mốc vẫn khớp.
    const oldGhi = rates['Ghi - Cafe'];
    const newGhi = value;
    const newVan = convertAluminumUnitPrice(rates['Vân Gỗ'], oldGhi, newGhi) || rates['Vân Gỗ'];
    const unitPricesByColor = scaleUnitPricesByGhiBaseChange(
      current.unitPricesByColor,
      oldGhi,
      newGhi,
    );
    return touchAluminumEstimatorState({
      ...current,
      colorBaseRates: { 'Ghi - Cafe': newGhi, 'Vân Gỗ': newVan },
      unitPricesByColor,
    });
  }

  // Đổi mốc Vân gỗ: giữ Ghi, chỉ tính lại Vân từ Ghi theo mốc mới
  const colorBaseRates = normalizeColorBaseRates({
    ...rates,
    'Vân Gỗ': value,
  });
  const unitPricesByColor = recomputeLinkedPricesFromBases(
    current.unitPricesByColor,
    colorBaseRates,
  );
  return touchAluminumEstimatorState({
    ...current,
    colorBaseRates,
    unitPricesByColor,
  });
}

/** Chọn màu; bấm lại đúng màu đang chọn thì không đánh dấu thay đổi. */
export function selectAluminumColor(
  current: AluminumEstimatorPageState,
  color: string,
): AluminumEstimatorPageState {
  const nextColor = normalizeAluminumColor(color);
  if (normalizeAluminumColor(current.color) === nextColor) return current;
  return touchAluminumEstimatorState({ ...current, color: nextColor });
}

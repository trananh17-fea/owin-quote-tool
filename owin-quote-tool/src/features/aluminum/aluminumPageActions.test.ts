import { describe, expect, it } from 'vitest';
import {
  createDefaultAluminumEstimatorState,
  type AluminumEstimatorPageState,
} from '@/features/aluminum/aluminumEstimatorStorage';
import {
  applyAluminumBaseRate,
  applyAluminumRowPatch,
  selectAluminumColor,
} from '@/features/aluminum/aluminumPageActions';

/**
 * Khoá công thức của trang "Tính nhôm" sau khi tách khỏi component: SL chỉ sống
 * trong session, đơn giá luôn quy đổi sang màu còn lại, và đổi mốc màu phải cho
 * đúng con số như bản cũ (mốc mặc định Ghi 147k / Vân Gỗ 154k).
 */

const SYSTEM_ID = 'noi-that';
const ROW_ID = 'noi-that-1-OWIN-NT01';

/** State đã có sẵn một ô đơn giá Ghi 150.000 (kèm ô Vân Gỗ quy đổi). */
function stateWithPrice(): AluminumEstimatorPageState {
  return applyAluminumRowPatch(
    createDefaultAluminumEstimatorState(),
    SYSTEM_ID,
    ROW_ID,
    { unitPrice: '150000' },
  );
}

describe('applyAluminumRowPatch — SL', () => {
  it('ghi SL nhưng không đánh dấu thay đổi (SL chỉ tạm)', () => {
    const next = applyAluminumRowPatch(
      createDefaultAluminumEstimatorState(),
      SYSTEM_ID,
      ROW_ID,
      { quantity: '3' },
    );
    expect(next.quantities[SYSTEM_ID]?.[ROW_ID]).toBe('3');
    expect(next.updatedAt).toBeNull();
    expect(next.unitPricesByColor).toEqual({});
  });

  it('SL rỗng thì xoá dòng, hết dòng thì xoá luôn hệ', () => {
    const withQty = applyAluminumRowPatch(
      createDefaultAluminumEstimatorState(),
      SYSTEM_ID,
      ROW_ID,
      { quantity: '3' },
    );
    const cleared = applyAluminumRowPatch(withQty, SYSTEM_ID, ROW_ID, { quantity: '' });
    expect(cleared.quantities).toEqual({});
  });
});

describe('applyAluminumRowPatch — đơn giá', () => {
  it('ghi màu đang chọn và quy đổi sang màu còn lại theo mốc', () => {
    const next = stateWithPrice();
    expect(next.unitPricesByColor['Ghi - Cafe']?.[SYSTEM_ID]?.[ROW_ID]).toEqual({
      unitPrice: '150000',
      note: '',
    });
    // 150.000 / 147.000 × 154.000 = 157.142,8… → làm tròn bội 1.000
    expect(next.unitPricesByColor['Vân Gỗ']?.[SYSTEM_ID]?.[ROW_ID]).toEqual({
      unitPrice: '157000',
      note: '',
    });
    expect(next.updatedAt).not.toBeNull();
  });

  it('xoá đơn giá thì xoá cả hai màu', () => {
    const cleared = applyAluminumRowPatch(stateWithPrice(), SYSTEM_ID, ROW_ID, { unitPrice: '' });
    expect(cleared.unitPricesByColor).toEqual({});
  });
});

describe('applyAluminumBaseRate', () => {
  it('đổi mốc Ghi: scale mọi đơn giá và scale luôn mốc Vân Gỗ', () => {
    const next = applyAluminumBaseRate(stateWithPrice(), 'Ghi - Cafe', 294000);
    expect(next.colorBaseRates).toEqual({ 'Ghi - Cafe': 294000, 'Vân Gỗ': 308000 });
    expect(next.unitPricesByColor['Ghi - Cafe']?.[SYSTEM_ID]?.[ROW_ID]?.unitPrice).toBe('300000');
    expect(next.unitPricesByColor['Vân Gỗ']?.[SYSTEM_ID]?.[ROW_ID]?.unitPrice).toBe('314000');
  });

  it('đổi mốc Vân Gỗ: giữ giá Ghi, tính lại giá Vân từ Ghi', () => {
    const next = applyAluminumBaseRate(stateWithPrice(), 'Vân Gỗ', 168000);
    expect(next.colorBaseRates).toEqual({ 'Ghi - Cafe': 147000, 'Vân Gỗ': 168000 });
    expect(next.unitPricesByColor['Ghi - Cafe']?.[SYSTEM_ID]?.[ROW_ID]?.unitPrice).toBe('150000');
    // 150.000 / 147.000 × 168.000 = 171.428,5… → 171.000
    expect(next.unitPricesByColor['Vân Gỗ']?.[SYSTEM_ID]?.[ROW_ID]?.unitPrice).toBe('171000');
  });

  it('mốc không đổi thì trả nguyên state', () => {
    const current = stateWithPrice();
    expect(applyAluminumBaseRate(current, 'Ghi - Cafe', 147000)).toBe(current);
  });

  it('mốc không hợp lệ thì quay về mặc định của màu đó', () => {
    const current = applyAluminumBaseRate(stateWithPrice(), 'Vân Gỗ', 168000);
    const next = applyAluminumBaseRate(current, 'Vân Gỗ', 0);
    expect(next.colorBaseRates['Vân Gỗ']).toBe(154000);
  });
});

describe('selectAluminumColor', () => {
  it('chọn lại đúng màu đang dùng thì không tạo state mới', () => {
    const current = createDefaultAluminumEstimatorState();
    expect(selectAluminumColor(current, 'Ghi - Cafe')).toBe(current);
  });

  it('đổi màu thì đánh dấu thay đổi', () => {
    const next = selectAluminumColor(createDefaultAluminumEstimatorState(), 'Vân Gỗ');
    expect(next.color).toBe('Vân Gỗ');
    expect(next.updatedAt).not.toBeNull();
  });
});

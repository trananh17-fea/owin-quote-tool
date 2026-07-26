import type { DimensionInput, ProductUnit, QuoteItemInput } from '@/types/models';
import { calculateDimensionLine } from './quoteCalculator';

/** Tổng SL (số cái) của mọi dòng kích thước trong 1 hạng mục. */
export function sumItemDimensionQuantity(item: Pick<QuoteItemInput, 'dimensions'>): number {
  return (item.dimensions || []).reduce((sum, line) => sum + Math.max(0, Number(line.quantity || 0)), 0);
}

/**
 * Thành tiền 1 dòng kích thước (chưa kể PK) — dùng để xếp hạng mục.
 * Lấy max trong các dòng của hạng mục.
 */
export function maxDimensionLineAmount(item: QuoteItemInput): number {
  const unit = (item.unit || 'M2') as ProductUnit;
  const price = Number(item.unitPriceVnd || 0);
  let max = 0;
  for (const line of item.dimensions || []) {
    const calculated = calculateDimensionLine(unit, line as DimensionInput, price);
    if (calculated.lineTotalVnd > max) max = calculated.lineTotalVnd;
  }
  return max;
}

/**
 * Xếp hạng mục báo giá: thành tiền dòng KT cao nhất → thấp.
 * Ổn định khi bằng nhau (giữ index gốc).
 */
export function sortQuoteItemsByMaxLineAmount<T extends QuoteItemInput>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index, amount: maxDimensionLineAmount(item) }))
    .sort((a, b) => b.amount - a.amount || a.index - b.index)
    .map((entry) => entry.item);
}

/** Sắp items + mảng song song (ui keys) theo cùng comparator. */
export function sortQuoteItemsWithKeys<T extends QuoteItemInput, K>(
  items: T[],
  keys: K[],
): { items: T[]; keys: K[] } {
  const paired = items.map((item, index) => ({
    item,
    key: keys[index],
    index,
    amount: maxDimensionLineAmount(item),
  }));
  paired.sort((a, b) => b.amount - a.amount || a.index - b.index);
  return {
    items: paired.map((row) => row.item),
    keys: paired.map((row) => row.key as K),
  };
}

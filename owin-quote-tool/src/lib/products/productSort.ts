import type { ProductRecord } from '@/types/models';
import { categoryOrderIndex } from '@/lib/products/categoryOrder';
import { buildCatalogueMoneyBlocks } from '@/lib/catalogue/catalogueMoney';

/**
 * Thứ tự màu ưu tiên (keyword không dấu, match `includes`).
 * Vân Gỗ Trắc → Vân Gỗ Lim → Ghi/Ghi Xanh/Ghi-Cafe → Xanh → khác.
 */
export const COLOR_ORDER = ['trac', 'lim', 'ghi', 'xanh'];

/**
 * Tổng tiền 1 SP trên bảng giá = tiền SP (size × đơn giá) + bộ PK + legacy + extra.
 * Cùng engine với cột "Thành tiền / hoàn thành" catalogue.
 */
export function productCatalogueTotalVnd(product: ProductRecord): number {
  return buildCatalogueMoneyBlocks(product).completedTotal;
}

function stripAccents(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/** Lấy nhãn màu từ spec "Màu" (hoặc key chứa "mau"). */
export function productColorLabel(product: ProductRecord): string {
  const colorSpec = product.specs.find((spec) => stripAccents(spec.key).includes('mau'));
  return String(colorSpec?.value || '').trim();
}

/** Rank màu: nhỏ = ưu tiên trước. Không có màu / lạ → cuối. */
export function productColorRank(product: ProductRecord): number {
  const color = stripAccents(productColorLabel(product));
  if (!color) return COLOR_ORDER.length + 1;
  const rank = COLOR_ORDER.findIndex((keyword) => color.includes(keyword));
  return rank === -1 ? COLOR_ORDER.length : rank;
}

/** Chỉ theo màu (giữ relative order trong cùng màu). */
export function sortProductsByColor<T extends ProductRecord>(products: T[]): T[] {
  return products
    .map((product, index) => ({ product, index }))
    .sort((a, b) => productColorRank(a.product) - productColorRank(b.product) || a.index - b.index)
    .map((entry) => entry.product);
}

/**
 * Sản phẩm / Bảng giá:
 * 1. Nhóm (loại cửa)
 * 2. Màu (Trắc → Lim → Ghi → Xanh → khác)
 * 3. Tổng tiền SP (cửa + PK + extra) cao → thấp
 */
export function sortProductsForCatalog<T extends ProductRecord>(products: T[]): T[] {
  return [...products].sort((a, b) => {
    const byCategory = categoryOrderIndex(a.category) - categoryOrderIndex(b.category);
    if (byCategory !== 0) return byCategory;

    const byColor = productColorRank(a) - productColorRank(b);
    if (byColor !== 0) return byColor;

    const totalA = productCatalogueTotalVnd(a);
    const totalB = productCatalogueTotalVnd(b);
    if (totalA !== totalB) return totalB - totalA;

    // Tie-break: đơn giá, rồi id/tên
    const priceA = Number(a.unitPriceVnd || 0);
    const priceB = Number(b.unitPriceVnd || 0);
    if (priceA !== priceB) return priceB - priceA;

    if ((a.numericId || 0) !== (b.numericId || 0)) return (a.numericId || 0) - (b.numericId || 0);
    return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
  });
}

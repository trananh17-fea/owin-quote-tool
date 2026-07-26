import { describe, expect, it } from 'vitest';
import type { ProductRecord } from '@/types/models';
import { productColorRank, sortProductsForCatalog } from './productSort';

function product(partial: Partial<ProductRecord> & Pick<ProductRecord, 'id' | 'name' | 'category' | 'unitPriceVnd'>): ProductRecord {
  return {
    numericId: 0,
    code: partial.id,
    slug: partial.id,
    unit: 'M2',
    shortDesc: null,
    coverImagePath: null,
    gallery: [],
    rawSizeText: null,
    rawPriceText: null,
    specs: partial.specs || [],
    accessories: [],
    fixedAccessoryPackage: null,
    extraAccessories: '',
    isFeatured: false,
    isPublic: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('productColorRank', () => {
  it('ranks Trắc → Lim → Ghi → Xanh', () => {
    expect(productColorRank(product({ id: '1', name: 'A', category: 'Cửa Chính', unitPriceVnd: 1, specs: [{ key: 'Màu', value: 'Vân Gỗ Trắc' }] }))).toBe(0);
    expect(productColorRank(product({ id: '2', name: 'B', category: 'Cửa Chính', unitPriceVnd: 1, specs: [{ key: 'Màu', value: 'Vân Gỗ Lim' }] }))).toBe(1);
    expect(productColorRank(product({ id: '3', name: 'C', category: 'Cửa Chính', unitPriceVnd: 1, specs: [{ key: 'Màu', value: 'Ghi Xanh' }] }))).toBe(2);
    expect(productColorRank(product({ id: '4', name: 'D', category: 'Cửa Chính', unitPriceVnd: 1, specs: [{ key: 'Màu', value: 'Xanh Navy' }] }))).toBe(3);
  });
});

describe('sortProductsForCatalog', () => {
  it('sorts by category, then color, then price high→low', () => {
    const list = [
      product({ id: 'a', name: 'Lim rẻ', category: 'Cửa Phụ', unitPriceVnd: 1_000_000, specs: [{ key: 'Màu', value: 'Vân Gỗ Lim' }] }),
      product({ id: 'b', name: 'Trắc rẻ', category: 'Cửa Chính', unitPriceVnd: 2_000_000, specs: [{ key: 'Màu', value: 'Vân Gỗ Trắc' }] }),
      product({ id: 'c', name: 'Trắc đắt', category: 'Cửa Chính', unitPriceVnd: 5_000_000, specs: [{ key: 'Màu', value: 'Vân Gỗ Trắc' }] }),
      product({ id: 'd', name: 'Ghi', category: 'Cửa Chính', unitPriceVnd: 9_000_000, specs: [{ key: 'Màu', value: 'Ghi - Cafe' }] }),
    ];
    const sorted = sortProductsForCatalog(list).map((p) => p.id);
    // Cửa Chính trước Cửa Phụ; trong Chính: Trắc (đắt→rẻ) rồi Ghi
    expect(sorted).toEqual(['c', 'b', 'd', 'a']);
  });
});

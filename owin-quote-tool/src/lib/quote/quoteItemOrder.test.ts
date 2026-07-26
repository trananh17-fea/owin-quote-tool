import { describe, expect, it } from 'vitest';
import type { QuoteItemInput } from '@/types/models';
import {
  maxDimensionLineAmount,
  sortQuoteItemsByMaxLineAmount,
  sumItemDimensionQuantity,
} from './quoteItemOrder';
import { enrichFixedAccessoryPackageValue } from '@/lib/quote-engine/fixed-accessory-rules';

function item(partial: Partial<QuoteItemInput> & Pick<QuoteItemInput, 'productCode' | 'itemName' | 'dimensions'>): QuoteItemInput {
  return {
    sourceType: 'CUSTOM',
    productId: null,
    quoteItemCode: partial.productCode,
    unit: 'M2',
    unitPriceVnd: 1_000_000,
    accessories: [],
    category: 'Cửa Chính',
    ...partial,
  };
}

describe('sumItemDimensionQuantity', () => {
  it('sums SL across lines', () => {
    expect(
      sumItemDimensionQuantity(
        item({
          productCode: 'A',
          itemName: 'A',
          dimensions: [
            { unit: 'M2', widthM: 1, heightM: 1, quantity: 2 },
            { unit: 'M2', widthM: 1, heightM: 1, quantity: 3 },
          ],
        }),
      ),
    ).toBe(5);
  });
});

describe('sortQuoteItemsByMaxLineAmount', () => {
  it('orders by max dimension line amount high→low', () => {
    const cheap = item({
      productCode: 'cheap',
      itemName: 'cheap',
      unitPriceVnd: 1_000_000,
      dimensions: [{ unit: 'M2', widthM: 1, heightM: 1, quantity: 1 }], // 1m² × 1tr = 1tr
    });
    const multi = item({
      productCode: 'multi',
      itemName: 'multi',
      unitPriceVnd: 1_000_000,
      dimensions: [
        { unit: 'M2', widthM: 1, heightM: 1, quantity: 1 }, // 1tr
        { unit: 'M2', widthM: 2, heightM: 2, quantity: 1 }, // 4tr ← max
      ],
    });
    const mid = item({
      productCode: 'mid',
      itemName: 'mid',
      unitPriceVnd: 2_000_000,
      dimensions: [{ unit: 'M2', widthM: 1, heightM: 1, quantity: 1 }], // 2tr
    });

    expect(maxDimensionLineAmount(multi)).toBe(4_000_000);
    expect(sortQuoteItemsByMaxLineAmount([cheap, multi, mid]).map((i) => i.productCode)).toEqual([
      'multi',
      'mid',
      'cheap',
    ]);
  });
});

describe('fixed package auto quantity', () => {
  it('uses total SL when not manual', () => {
    const raw = JSON.stringify({
      name: 'Bộ PK',
      items: [{ name: 'Khóa', quantity: 1 }],
      packageQuantity: 1,
      unitPrice: 100_000,
    });
    const enriched = JSON.parse(enrichFixedAccessoryPackageValue(raw, 7) || '{}');
    expect(enriched.packageQuantity).toBe(7);
  });

  it('keeps manual package quantity', () => {
    const raw = JSON.stringify({
      name: 'Bộ PK',
      items: [{ name: 'Khóa', quantity: 1 }],
      packageQuantity: 2,
      packageQuantityManual: true,
      unitPrice: 100_000,
    });
    const enriched = JSON.parse(enrichFixedAccessoryPackageValue(raw, 7) || '{}');
    expect(enriched.packageQuantity).toBe(2);
  });
});

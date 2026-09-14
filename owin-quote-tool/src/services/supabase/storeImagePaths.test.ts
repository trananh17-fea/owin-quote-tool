import { afterEach, describe, expect, it } from 'vitest';
import { setCurrentStoreId } from '@/services/supabase/currentStore';
import { storagePathFor } from '@/services/supabase/imagesRepo';
import { variantPathFor } from '@/features/export/exportImage';

afterEach(() => setCurrentStoreId(null));

describe('đường dẫn ảnh theo cửa hàng', () => {
  it('gắn tiền tố cửa hàng vào mọi đường dẫn mới', () => {
    setCurrentStoreId('cua-hang-b');
    expect(storagePathFor('SP001', 'anh.webp')).toBe('cua-hang-b/products/sp001/anh.webp');
  });

  it('không sinh đường dẫn khi chưa biết cửa hàng', () => {
    expect(() => storagePathFor('SP001', 'anh.webp')).toThrow(/cửa hàng/);
  });

  it('suy ra bản rút gọn cho ảnh có tiền tố cửa hàng', () => {
    expect(variantPathFor('owin/img/abc123.webp')).toBe('owin/export/abc123.jpg');
  });

  it('vẫn suy ra được cho ảnh cũ nằm phẳng ở gốc bucket', () => {
    expect(variantPathFor('img/abc123.webp')).toBe('export/abc123.jpg');
  });

  it('bỏ qua đường dẫn không phải ảnh gốc', () => {
    expect(variantPathFor('owin/thumb/abc123.webp')).toBeNull();
    expect(variantPathFor('owin/products/sp001/anh.webp')).toBeNull();
  });
});

import type { ProductRecord } from '@/types/models';

/**
 * Sản phẩm này có hiện trên trang công khai không?
 *
 * Cờ công khai nằm ở HAI nơi phải luôn khớp nhau:
 *  - cột quan hệ `products.is_public` — nơi RLS lọc để quyết định anon đọc được
 *    dòng nào (`products_anon_read`);
 *  - `data.isPublic` trong document jsonb — nơi app đọc lên (`productFromRow`).
 * `rowFromProduct` ghi cả hai trong cùng một lần lưu, nên đường ghi duy nhất
 * được phép dùng là `saveProduct`. Ghi lẻ một bên là admin thấy một đằng, web
 * công khai làm một nẻo.
 *
 * Cột quan hệ mặc định `true`, nên **thiếu giá trị nghĩa là ĐANG công khai**.
 * Đừng viết `Boolean(product.isPublic)`: sản phẩm tạo trước khi có cờ này sẽ
 * hiện là "đang ẩn" trong admin trong khi web công khai vẫn phục vụ chúng —
 * chủ cửa hàng tưởng đã ẩn mà thực ra chưa.
 */
export function isProductPublic(product: Pick<ProductRecord, 'isPublic'>): boolean {
  return product.isPublic !== false;
}

/** Trạng thái sau khi bấm nút bật/tắt. */
export function nextPublicState(product: Pick<ProductRecord, 'isPublic'>): boolean {
  return !isProductPublic(product);
}

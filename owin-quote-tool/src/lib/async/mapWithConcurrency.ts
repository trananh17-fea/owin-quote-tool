/**
 * Chạy song song có giới hạn.
 *
 * Các trình xuất (Word/Excel/PDF) trước đây tải ảnh tuần tự trong vòng lặp:
 * N ảnh = N lượt đi–về mạng nối đuôi nhau, nên bảng giá vài trăm dòng phải chờ
 * rất lâu mới hiện tab tải về. Hàm này giữ nguyên thứ tự kết quả nhưng cho phép
 * `limit` việc chạy cùng lúc — đủ nhanh mà không làm nghẽn kết nối trình duyệt.
 */
export const DEFAULT_IMAGE_CONCURRENCY = 8;

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  if (items.length === 0) return results;

  const workers = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (;;) {
        const index = cursor++;
        if (index >= items.length) return;
        results[index] = await task(items[index]!, index);
      }
    }),
  );

  return results;
}

/**
 * Một dòng log cho mỗi lần xuất file.
 *
 * Mở DevTools → Console rồi xuất là thấy ngay đang nghẽn ở đâu: tổng thời gian,
 * bao nhiêu ảnh, lấy được bản thumb hay phải rơi về ảnh master, tải xuống bao
 * nhiêu MB, và trong tổng đó phần ảnh chiếm bao lâu.
 *
 * Cố tình để mặc định bật (một dòng `console.info` mỗi lần bấm xuất): không có
 * nó thì mọi phán đoán về tốc độ đều là đoán mò.
 */

import {
  flushExportVariants,
  readExportImageStats,
  resetExportImageStats,
} from '@/features/export/exportImage';

function mb(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(2)}MB`;
}

/** Bọc một lần xuất file để đo; không đổi kết quả trả về. */
export async function trackExport<T>(label: string, run: () => Promise<T>): Promise<T> {
  resetExportImageStats();
  const startedAt = Date.now();
  try {
    return await run();
  } finally {
    const total = Date.now() - startedAt;
    const stats = readExportImageStats();
    console.info(
      `[xuất] ${label}: ${total}ms` +
        ` · ảnh ${stats.imageMs}ms cho ${stats.images} tấm` +
        ` (${stats.variantHits} rút gọn / ${stats.renderHits} CDN / ${stats.thumbHits} thumb` +
        ` / ${stats.masterFallbacks} master / ${stats.cacheHits} sẵn có` +
        ` / ${stats.reused} nhúng thẳng)` +
        ` · tải ${mb(stats.bytesIn)} → nhúng ${mb(stats.bytesOut)}` +
        (stats.variantsQueued ? ` · đang dựng ${stats.variantsQueued} bản rút gọn cho lần sau` : ''),
    );
    // Sau khi file đã tải về mới dựng bản rút gọn, để không giành băng thông.
    void flushExportVariants();
  }
}

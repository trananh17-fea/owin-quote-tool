import ExcelJS from 'exceljs';
import type { ProductRecord } from '@/types/models';
import { resolveItemImage } from '@/lib/media/itemImageResolver';
import { toExcelImage } from '@/features/export/excelImage';
import { buildCatalogueBlockRows } from '@/lib/catalogue/catalogueRows';
import { downloadBlob } from '@/lib/browser/download';
import { DEFAULT_IMAGE_CONCURRENCY, mapWithConcurrency } from '@/lib/async/mapWithConcurrency';

const HEADERS = ['STT', 'Hình ảnh', 'Mô tả chi tiết', 'DV', 'Rộng', 'Cao', 'KL', 'Đơn giá', 'Thành tiền', 'Tổng tiền'];


function money(value: number | null): number | '' {
  return value ? value : '';
}

function styleBorder(): Partial<ExcelJS.Borders> {
  const line = { style: 'thin' as const, color: { argb: 'FF283846' } };
  return { top: line, left: line, bottom: line, right: line };
}

export async function exportCatalogueExcel(products: ProductRecord[]): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'OWIN Quote Tool';
  const sheet = workbook.addWorksheet('Bang gia', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  sheet.columns = [
    { width: 6 },
    { width: 16 },
    { width: 44 },
    { width: 7 },
    { width: 9 },
    { width: 9 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
  ];

  const companyRow = sheet.addRow(['HOÀNG ANH OWIN', '', 'Tiên Điền - Nghi Xuân - Hà Tĩnh · 0799040616']);
  sheet.mergeCells(companyRow.number, 1, companyRow.number, 2);
  sheet.mergeCells(companyRow.number, 3, companyRow.number, 10);
  companyRow.font = { bold: true };
  companyRow.alignment = { horizontal: 'center' };

  const titleRow = sheet.addRow(['BẢNG GIÁ NHÔM OWIN LẮP ĐẶT HOÀN THIỆN']);
  sheet.mergeCells(titleRow.number, 1, titleRow.number, 10);
  titleRow.getCell(1).font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
  titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4B6078' } };
  titleRow.getCell(1).alignment = { horizontal: 'center' };

  const headerRow = sheet.addRow(HEADERS);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0E2F44' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = styleBorder();
  });

  const blockRows = buildCatalogueBlockRows(products);
  const productByCode = new Map(products.map((product) => [product.code, product]));

  // Tải + chuyển đổi toàn bộ ảnh trước, song song có giới hạn. Trước đây mỗi
  // dòng phải chờ xong ảnh của mình rồi mới sang dòng kế, nên bảng giá dài mất
  // hàng chục giây mới hiện hộp tải về. Mỗi mã sản phẩm chỉ nhúng một ảnh.
  const imageCodes = [
    ...new Set(
      blockRows.flatMap((row) =>
        row.rowType === 'product' && row.imagePath && productByCode.has(row.productCode)
          ? [row.productCode]
          : [],
      ),
    ),
  ];
  const imageIdByCode = new Map<string, number>();
  const loadedImages = await mapWithConcurrency(imageCodes, DEFAULT_IMAGE_CONCURRENCY, async (code) => {
    const resolved = await resolveItemImage(productByCode.get(code)!, products, { loadBlob: true });
    try {
      return resolved.blob ? await toExcelImage(resolved.blob) : null;
    } finally {
      if (resolved.revoke && resolved.url) URL.revokeObjectURL(resolved.url);
    }
  });
  imageCodes.forEach((code, index) => {
    const image = loadedImages[index];
    if (image) imageIdByCode.set(code, workbook.addImage(image));
  });

  for (const row of blockRows) {
    if (row.rowType === 'category') {
      const categoryRow = sheet.addRow([row.categoryName]);
      sheet.mergeCells(categoryRow.number, 1, categoryRow.number, 10);
      categoryRow.getCell(1).font = { bold: true };
      categoryRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } };
      categoryRow.getCell(1).border = styleBorder();
      continue;
    }

    const excelRow = sheet.addRow([
      row.stt,
      row.imagePath ? 'Có ảnh' : '',
      row.description,
      row.unit,
      row.width,
      row.height,
      row.weight,
      money(row.unitPriceVnd),
      money(row.amountVnd),
      money(row.completedTotalVnd),
    ]);
    excelRow.height = Math.max(24, row.descriptionLines.length * 18);
    const imageId = imageIdByCode.get(row.productCode);
    if (imageId !== undefined && row.imagePath) {
      sheet.addImage(imageId, { tl: { col: 1.1, row: excelRow.number - 1 + 0.1 }, ext: { width: 105, height: 58 } });
    }
    excelRow.eachCell((cell, columnNumber) => {
      cell.border = styleBorder();
      cell.alignment = {
        vertical: 'middle',
        horizontal: columnNumber >= 7 ? 'right' : columnNumber === 1 || columnNumber === 4 ? 'center' : 'left',
        wrapText: true,
      };
      if (columnNumber >= 8) cell.numFmt = '#,##0';
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `BangGia_OWIN_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

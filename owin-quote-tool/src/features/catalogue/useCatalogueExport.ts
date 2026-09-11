import { useState } from 'react';
import type { ProductRecord } from '@/types/models';

/**
 * Ba nút xuất của tab Bảng giá. Tách khỏi view để view chỉ còn state hiển thị;
 * thông báo lỗi và luồng gọi module xuất giữ nguyên như bản cũ.
 */
export function useCatalogueExport(shownRecords: ProductRecord[]) {
  const [exporting, setExporting] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportError, setExportError] = useState('');

  const exportWord = async () => {
    setExporting(true);
    setExportError('');
    try {
      const { exportCatalogueWord } = await import('@/features/export/wordExport');
      await exportCatalogueWord(shownRecords);
    } catch {
      setExportError('Không thể xuất bảng giá Word. Vui lòng kiểm tra mạng và thử lại.');
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = async () => {
    setExportingExcel(true);
    setExportError('');
    try {
      const { exportCatalogueExcel } = await import('@/features/export/catalogueExcelExport');
      await exportCatalogueExcel(shownRecords);
    } catch {
      setExportError('Không thể xuất bảng giá Excel. Vui lòng thử lại.');
    } finally {
      setExportingExcel(false);
    }
  };

  const exportPdf = async () => {
    setExportingPdf(true);
    setExportError('');
    try {
      // File download only — never window.print / browser "Save as PDF".
      const { exportCataloguePdf } = await import('@/features/export/cataloguePdfExport');
      const fileName = await exportCataloguePdf(shownRecords);
      if (!fileName) throw new Error('PDF rỗng');
    } catch (error) {
      const detail = error instanceof Error && error.message ? `: ${error.message}` : '';
      setExportError(`Không thể xuất bảng giá PDF${detail}. Dùng nút PDF (không in trình duyệt).`);
    } finally {
      setExportingPdf(false);
    }
  };

  return {
    exporting,
    exportingExcel,
    exportingPdf,
    exportError,
    exportWord,
    exportExcel,
    exportPdf,
  };
}

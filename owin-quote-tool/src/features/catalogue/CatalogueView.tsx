import { useMemo, useState } from 'react';
import { useProducts } from '@/features/products';
import { buildCatalogueBlockRows } from '@/lib/catalogue/catalogueRows';
import {
  filterRecordsByCategory,
  groupCatalogueBlocks,
  listCatalogueCategories,
} from '@/features/catalogue/catalogueBlocks';
import { useCatalogueExport } from '@/features/catalogue/useCatalogueExport';
import { CatalogueToolbar } from '@/features/catalogue/CatalogueToolbar';
import { CatalogueDocument } from '@/features/catalogue/CatalogueDocument';
import './catalogue.css';

/** Tab Bảng giá: xem tài liệu A4 và xuất Word/Excel/PDF theo loại cửa. */
export function CatalogueView() {
  const { productRecords, loading, error: productsError, retry } = useProducts();
  // Xuất theo loại cửa: 'all' = tất cả, hoặc 1 danh mục cụ thể.
  const [exportCategory, setExportCategory] = useState('all');
  const categories = useMemo(() => listCatalogueCategories(productRecords), [productRecords]);
  const shownRecords = useMemo(
    () => filterRecordsByCategory(productRecords, exportCategory),
    [productRecords, exportCategory],
  );
  const rows = useMemo(() => buildCatalogueBlockRows(shownRecords), [shownRecords]);
  const blocks = useMemo(() => groupCatalogueBlocks(rows), [rows]);
  const {
    exporting,
    exportingExcel,
    exportingPdf,
    exportError,
    exportWord,
    exportExcel,
    exportPdf,
  } = useCatalogueExport(shownRecords);

  return (
    <section className="admin-page catalogue-page">
      <CatalogueToolbar
        loading={loading}
        totalCount={productRecords.length}
        shownCount={shownRecords.length}
        exportCategory={exportCategory}
        onExportCategoryChange={setExportCategory}
        categories={categories}
        exporting={exporting}
        exportingExcel={exportingExcel}
        exportingPdf={exportingPdf}
        onExportWord={() => void exportWord()}
        onExportExcel={() => void exportExcel()}
        onExportPdf={() => void exportPdf()}
      />

      {(productsError || exportError) && (
        <div className="data-error no-print" role="alert">
          <span>{exportError || productsError}</span>
          {productsError && (
            <button type="button" className="btn btn-ghost" onClick={() => void retry()}>
              Thử tải lại
            </button>
          )}
        </div>
      )}

      <CatalogueDocument rows={rows} blocks={blocks} />
    </section>
  );
}

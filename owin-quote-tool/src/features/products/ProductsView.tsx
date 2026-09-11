import { useCallback, useMemo, useState } from 'react';
import type { ProductRecord } from '@/types/models';
import { reorderList } from '@/components/DragReorder';
import { sortCategoryNames } from '@/lib/products/categoryOrder';
import { sortProductsForCatalog } from '@/lib/products/productSort';
import { paginateItems, type PageSize } from '@/lib/list/paginateItems';
import { rememberProductSuggestions } from '@/features/suggestions/suggestionStore';
import { useSuggestions } from '@/features/suggestions/useSuggestions';
import { useProducts } from '@/features/products/useProducts';
import { getProductRecord, reorderProducts } from '@/features/products/productStore';
import { generateProductCode } from '@/features/products/productCode';
import {
  PRODUCT_SUGGESTION_TYPES,
  buildProductSuggestions,
} from '@/features/products/productSuggestions';
import { ProductForm, type ProductFormSaveOptions } from '@/features/products/ProductForm';
import { ProductList } from '@/features/products/ProductList';
import { ProductPreviewCard } from '@/features/products/ProductPreviewCard';
import { ProductToolbar } from '@/features/products/ProductToolbar';
import { BulkPriceDialog } from '@/features/products/BulkPriceDialog';
import './products.css';

/** Chuỗi để tìm kiếm của một sản phẩm — gộp mã, tên, nhóm, đơn vị, kích thước, thông số. */
function searchHaystack(product: ProductRecord): string {
  return [
    product.code,
    product.name,
    product.category,
    product.unit,
    product.rawSizeText,
    product.specs.map((spec) => `${spec.key} ${spec.value}`).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Màn quản lý sản phẩm gốc (catalog). */
export function ProductsView({ onOpenCatalogue }: { onOpenCatalogue?: () => void }) {
  const {
    productRecords,
    loading,
    error: productsError,
    retry: retryProducts,
    saveProduct,
    deleteProduct,
  } = useProducts();
  const {
    suggestions: seededSuggestions,
    error: suggestionsError,
    refreshSuggestions,
    retry: retrySuggestions,
  } = useSuggestions(PRODUCT_SUGGESTION_TYPES);

  const [editing, setEditing] = useState<ProductRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [previewProduct, setPreviewProduct] = useState<ProductRecord | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [operationError, setOperationError] = useState('');
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);

  const suggestions = useMemo(
    () => buildProductSuggestions(productRecords, seededSuggestions),
    [productRecords, seededSuggestions],
  );

  const categories = useMemo(
    () => Array.from(new Set(productRecords.map((product) => product.category).filter(Boolean))).sort(sortCategoryNames),
    [productRecords],
  );

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = productRecords.filter((product) => {
      const categoryOk = !selectedCategory || product.category === selectedCategory;
      return categoryOk && (!query || searchHaystack(product).includes(query));
    });
    // Nhóm → màu (Trắc → Lim → Ghi → Xanh) → giá cao → thấp.
    return sortProductsForCatalog(filtered);
  }, [productRecords, searchQuery, selectedCategory]);

  const pagination = useMemo(
    () => paginateItems(filteredProducts, currentPage, pageSize),
    [currentPage, filteredProducts, pageSize],
  );

  const handleSearchChange = (value: string) => {
    setCurrentPage(1);
    setSearchQuery(value);
  };
  const handleCategoryChange = (value: string) => {
    setCurrentPage(1);
    setSelectedCategory(value);
  };

  const openNew = () => {
    setEditing(null);
    setMessage('');
    setOperationError('');
    setShowForm(true);
  };
  const openEdit = (product: ProductRecord) => {
    setEditing(product);
    setMessage('');
    setOperationError('');
    setShowForm(true);
  };
  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditing(null);
  }, []);

  const handleDelete = async (product: ProductRecord) => {
    if (!confirm(`Xoá sản phẩm "${product.name}" (${product.code})?`)) return;
    setOperationError('');
    try {
      await deleteProduct(product.id);
      setMessage(`Đã xoá "${product.name}".`);
    } catch {
      setOperationError('Không thể xoá sản phẩm trên Supabase. Vui lòng thử lại.');
    }
  };

  const handleDuplicate = async (product: ProductRecord) => {
    setDuplicatingId(product.id);
    setMessage('');
    setOperationError('');
    try {
      // Mã bản sao render theo thời gian (giống lúc tạo mới), không dính "-COPY-".
      const copyCode = generateProductCode(true);
      // Giữ nguyên tên gốc; gỡ mọi tiền tố "Copy:" cũ để bản sao không bao giờ dính chữ "Copy".
      const cleanName = product.name.replace(/^\s*copy\s*:\s*/i, '').trim() || product.name;
      const saved = await saveProduct({
        ...product,
        id: undefined,
        numericId: undefined,
        code: copyCode,
        name: cleanName,
        isFeatured: false,
        createdAt: undefined,
        updatedAt: undefined,
        deletedAt: null,
        deleted: undefined,
      });
      setMessage(`Đã nhân bản "${product.name}".`);
      // Suggestions are secondary metadata. A failure here must never make a
      // successfully-created product look failed and tempt the user to retry.
      try {
        const record = await getProductRecord(saved.id);
        if (record) {
          setEditing(record);
          setShowForm(true);
          await rememberProductSuggestions(record);
        }
        await refreshSuggestions();
      } catch {
        // The product is already safely committed; Realtime will refresh it.
      }
    } catch {
      setOperationError('Không thể nhân bản sản phẩm trên Supabase. Vui lòng thử lại.');
    } finally {
      setDuplicatingId(null);
    }
  };

  // Drag reorder vẫn cho phép chỉnh tay; thứ tự hiển thị mặc định theo nhóm/màu/giá.
  const canReorder = !searchQuery.trim() && !selectedCategory;
  const handleReorder = async (from: number, to: number) => {
    const nextOrder = reorderList(filteredProducts, from, to);
    setOperationError('');
    try {
      await reorderProducts(nextOrder.map((product) => product.id));
    } catch {
      setOperationError('Không thể lưu thứ tự sản phẩm. Vui lòng thử lại.');
    }
  };

  const handleSave = async (
    input: Parameters<typeof saveProduct>[0],
    options?: ProductFormSaveOptions,
  ) => {
    const saved = await saveProduct(input, { baseRecord: options?.baseRecord });
    // Suggestions must never block the save ACK / autosave UI.
    if (options?.learnSuggestions !== false) {
      void (async () => {
        try {
          await rememberProductSuggestions(saved);
          await refreshSuggestions();
        } catch {
          // Autocomplete ranking is secondary; the product save already succeeded.
        }
      })();
    }
    return saved;
  };

  if (showForm) {
    return (
      <section className="admin-page product-workflow-page">
        <ProductForm
          key={editing?.id ?? 'new'}
          editing={editing}
          suggestions={suggestions}
          onSave={handleSave}
          onCancel={closeForm}
        />
      </section>
    );
  }

  const dataError = operationError || productsError || suggestionsError;

  return (
    <section className="admin-page product-list-page product-workflow-page">
      <div className="admin-page-heading product-list-heading">
        <div>
          <div className="product-list-title-row">
            <h1 className="app-title">Quản lý sản phẩm</h1>
            <span className="product-list-count">{productRecords.length} sản phẩm</span>
          </div>
          <p className="app-subtitle">
            {loading ? 'Đang tải danh mục sản phẩm…' : 'Danh mục sản phẩm nhôm kính hệ OWIN'}
          </p>
        </div>
      </div>

      {message && <div className="toast">{message}</div>}
      {dataError && (
        <div className="data-error" role="alert">
          <span>{dataError}</span>
          {(productsError || suggestionsError) && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setOperationError('');
                void Promise.all([retryProducts(), retrySuggestions()]);
              }}
            >
              Thử tải lại
            </button>
          )}
        </div>
      )}

      <ProductToolbar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        categories={categories}
        canBulkPrice={productRecords.length > 0}
        onOpenCatalogue={onOpenCatalogue}
        onOpenBulkPrice={() => setBulkPriceOpen(true)}
        onCreate={openNew}
      />

      <ProductList
        products={pagination.items}
        pagination={pagination}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
        loading={loading}
        totalCount={productRecords.length}
        duplicatingId={duplicatingId}
        reorderable={canReorder}
        onReorder={(from, to) => void handleReorder(from, to)}
        onEdit={openEdit}
        onDelete={handleDelete}
        onDuplicate={(product) => void handleDuplicate(product)}
        onPreview={setPreviewProduct}
      />

      {bulkPriceOpen && (
        <BulkPriceDialog
          products={productRecords}
          onClose={() => setBulkPriceOpen(false)}
          onDone={(text) => {
            setMessage(text);
            setBulkPriceOpen(false);
          }}
          onError={setOperationError}
        />
      )}

      {previewProduct && (
        <ProductPreviewCard
          product={previewProduct}
          onClose={() => setPreviewProduct(null)}
          onEdit={(product) => {
            setPreviewProduct(null);
            openEdit(product);
          }}
        />
      )}
    </section>
  );
}

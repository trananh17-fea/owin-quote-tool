/* Effect below intentionally resets local picker state when the modal closes. */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { Package, Search, X } from 'lucide-react';
import type { ProductRecord } from '@/types/models';
import { formatVND } from '@/lib/format/currency';
import { normalizeCategoryName } from '@/lib/products/categoryOrder';
import { ProductThumb } from '@/components/ProductThumb';
import { ProductPreviewCard } from '@/features/products';
import { unitLabelShort } from '@/features/quote/quoteFormat';

/** Modal chọn sản phẩm từ kho để thêm vào báo giá (ô tìm, dải danh mục, lưới thẻ, xem chi tiết). */
export function QuoteProductPicker({
  isOpen,
  search,
  categoryFilter,
  categories,
  filteredProducts,
  productCount,
  onSearch,
  onCategoryFilter,
  onSelect,
  onClose,
}: {
  isOpen: boolean;
  search: string;
  categoryFilter: string;
  categories: string[];
  filteredProducts: ProductRecord[];
  productCount: number;
  onSearch: (value: string) => void;
  onCategoryFilter: (value: string) => void;
  onSelect: (productId: string) => void;
  onClose: () => void;
}) {
  const [categoriesCollapsed, setCategoriesCollapsed] = useState(false);
  const [detailProduct, setDetailProduct] = useState<ProductRecord | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCategoriesCollapsed(false);
      setDetailProduct(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="quote-picker-backdrop" role="presentation" onClick={onClose}>
      <div className="quote-picker-modal" role="dialog" aria-modal="true" aria-label="Chọn sản phẩm" onClick={(event) => event.stopPropagation()}>
        <div className="quote-picker-header">
          <div className="quote-picker-title">
            <div className="quote-picker-icon"><Package size={20} /></div>
            <div>
              <h2>Chọn sản phẩm</h2>
              <p>{productCount} sản phẩm · bấm ảnh để xem chi tiết · bấm thẻ để chọn nhanh</p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Đóng chọn sản phẩm">
            <X size={18} />
          </button>
        </div>

        <div className="quote-picker-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => {
              onSearch(event.target.value);
              onCategoryFilter('');
            }}
            placeholder="Tìm theo tên hoặc nhóm..."
            autoFocus
          />
        </div>

        <div className={`quote-picker-categories${categoriesCollapsed ? ' is-collapsed' : ''}`}>
          <button
            type="button"
            className="quote-picker-cat-toggle"
            onClick={() => setCategoriesCollapsed((v) => !v)}
          >
            {categoriesCollapsed ? 'Hiện danh mục' : 'Thu gọn danh mục'}
          </button>
          {!categoriesCollapsed && (
            <>
              <button className={!categoryFilter ? 'active' : ''} onClick={() => onCategoryFilter('')} type="button">
                Tất cả ({productCount})
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  className={categoryFilter === category ? 'active' : ''}
                  onClick={() => onCategoryFilter(category)}
                  type="button"
                >
                  {category}
                </button>
              ))}
            </>
          )}
        </div>

        <div className="quote-picker-results">
          {filteredProducts.length === 0 ? (
            <div className="empty-line">Không tìm thấy sản phẩm phù hợp.</div>
          ) : (
            <div className="quote-picker-grid">
              {filteredProducts.map((product) => (
                <div key={product.id} className="quote-picker-card">
                  <button
                    type="button"
                    className="quote-picker-thumb image-fit-frame"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDetailProduct(product);
                      setCategoriesCollapsed(true);
                    }}
                    aria-label={`Xem chi tiết ${product.name}`}
                  >
                    <ProductThumb imagePath={product.coverImagePath} fill thumb />
                  </button>
                  <button
                    type="button"
                    className="quote-picker-card-body"
                    onClick={() => onSelect(product.id)}
                  >
                    <strong>{product.name}</strong>
                    {product.category ? (
                      <span className="quote-picker-meta">{normalizeCategoryName(product.category)}</span>
                    ) : null}
                    <span className="quote-picker-price">
                      {formatVND(product.unitPriceVnd)}
                      <small>/{unitLabelShort(product.unit)}</small>
                    </span>
                    <span className="quote-picker-choose">Chọn</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {detailProduct && (
        <ProductPreviewCard
          product={detailProduct}
          onClose={() => setDetailProduct(null)}
          onSelect={(product) => {
            setDetailProduct(null);
            onSelect(product.id);
          }}
          selectLabel="Thêm vào báo giá"
        />
      )}
    </div>
  );
}

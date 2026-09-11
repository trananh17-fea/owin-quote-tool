import { ChevronLeft, ChevronRight, Copy, Package, Pencil, Search, Trash2 } from 'lucide-react';
import type { ProductRecord } from '@/types/models';
import { formatVND } from '@/lib/format/currency';
import { normalizeCategoryName } from '@/lib/products/categoryOrder';
import { titleCaseVi } from '@/lib/format/titleCase';
import { PAGE_SIZES, type PageSize, type PaginationResult } from '@/lib/list/paginateItems';
import { mergeRowDragProps, useDragReorder } from '@/components/DragReorder';
import { ProductThumb } from '@/components/ProductThumb';
import { unitLabel } from '@/features/products/productUnits';

interface Props {
  /** Chỉ các sản phẩm của trang hiện tại. */
  products: ProductRecord[];
  pagination: PaginationResult<ProductRecord>;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
  loading?: boolean;
  totalCount?: number;
  duplicatingId?: string | null;
  /** Enable drag-to-reorder (only when the list is unfiltered). */
  reorderable?: boolean;
  onReorder?: (from: number, to: number) => void;
  onEdit: (p: ProductRecord) => void;
  onDelete: (p: ProductRecord) => void;
  onDuplicate: (p: ProductRecord) => void;
  onPreview: (p: ProductRecord) => void;
}

/** Bảng danh mục sản phẩm: một card, đầu bảng sticky, footer phân trang. */
export function ProductList({
  products,
  pagination,
  pageSize,
  onPageChange,
  onPageSizeChange,
  loading,
  totalCount,
  duplicatingId,
  reorderable,
  onReorder,
  onEdit,
  onDelete,
  onDuplicate,
  onPreview,
}: Props) {
  // Hàng hiển thị theo trang, còn thứ tự lưu xuống Supabase tính trên toàn danh
  // sách — cộng offset của trang để index không lệch khi đang ở trang 2 trở đi.
  const pageOffset = (pagination.page - 1) * pageSize;
  const { handleProps, rowProps } = useDragReorder((from, to) =>
    onReorder?.(pageOffset + from, pageOffset + to),
  );
  // Không có cột tay cầm: chính hàng vừa là thứ kéo được, vừa là vùng thả. Hai
  // nhóm prop không trùng key nên trải cả hai lên <tr> là đủ.
  const dragRowProps = (index: number) =>
    reorderable ? mergeRowDragProps(handleProps(index), rowProps(index)) : {};

  if (loading) {
    return (
      <div className="product-table-card product-list-skeleton">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return totalCount ? (
      <div className="empty-card">
        <Search size={44} />
        <h3>Không tìm thấy sản phẩm</h3>
        <p>Thử đổi từ khóa hoặc nhóm sản phẩm đang lọc.</p>
      </div>
    ) : (
      <div className="empty-card">
        <Package size={44} />
        <h3>Chưa có sản phẩm</h3>
        <p>Hãy tạo sản phẩm đầu tiên để bắt đầu quản lý báo giá.</p>
      </div>
    );
  }

  return (
    <div className="product-table-card">
      <div className="product-table-wrap">
        <table className="product-table">
          <thead>
            <tr>
              <th scope="col" data-col="image">Hình ảnh</th>
              <th scope="col" data-col="name">Tên sản phẩm</th>
              <th scope="col" data-col="category">Nhóm sản phẩm</th>
              <th scope="col" data-col="unit">Đơn vị</th>
              <th scope="col" data-col="size">Kích thước mẫu</th>
              <th scope="col" data-col="price">Đơn giá</th>
              <th scope="col" data-col="actions">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, index) => (
              <tr
                key={p.id}
                data-ma={p.code}
                className={reorderable ? 'product-row product-row-reorderable' : 'product-row'}
                tabIndex={0}
                aria-label={reorderable
                  ? `Xem chi tiết sản phẩm ${p.code}. Kéo hàng để đổi thứ tự.`
                  : `Xem chi tiết sản phẩm ${p.code}`}
                onClick={() => onPreview(p)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onPreview(p);
                  }
                }}
                {...dragRowProps(index)}
              >
                <td data-col="image">
                  <button
                    className="product-image-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onPreview(p);
                    }}
                    aria-label={`Xem ảnh ${p.code}`}
                  >
                    <ProductThumb imagePath={p.coverImagePath} fill thumb />
                  </button>
                </td>
                <td data-col="name">
                  <div className="product-name">{titleCaseVi(p.name) || p.name}</div>
                  <div className="product-table-code">{p.code}</div>
                  <div className="product-row-mobile-meta">
                    <span>{normalizeCategoryName(p.category)}</span>
                    <span>{unitLabel(p.unit)}</span>
                    {p.rawSizeText ? <span>{p.rawSizeText}</span> : null}
                  </div>
                </td>
                <td data-col="category">{normalizeCategoryName(p.category)}</td>
                <td data-col="unit">{unitLabel(p.unit)}</td>
                <td data-col="size">{p.rawSizeText || '—'}</td>
                <td className="num" data-col="price">{formatVND(p.unitPriceVnd)}</td>
                <td data-col="actions">
                  <div className="product-table-actions">
                    <button
                      className="icon-btn product-edit-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(p);
                      }}
                      aria-label={`Sửa ${p.code}`}
                      title="Sửa sản phẩm"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-btn product-copy-action"
                      disabled={duplicatingId === p.id}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDuplicate(p);
                      }}
                      aria-label={`Nhân bản ${p.code}`}
                      title="Nhân bản"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      className="icon-btn danger product-delete-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(p);
                      }}
                      aria-label={`Xoá ${p.code}`}
                      title="Xoá sản phẩm"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav className="product-list-pagination" aria-label="Phân trang danh sách sản phẩm">
        <div className="product-pagination-summary">
          <span>
            Hiển thị {pagination.firstItemNumber}–{pagination.lastItemNumber} / {pagination.totalItems} sản phẩm
          </span>
          <label>
            Mỗi trang
            <select
              className="input product-page-size-select"
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value) as PageSize)}
              aria-label="Số sản phẩm mỗi trang"
            >
              {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
        </div>
        <div className="product-pagination-controls">
          <button
            type="button"
            className="icon-btn"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            aria-label="Trang trước"
          >
            <ChevronLeft size={17} />
          </button>
          <span aria-live="polite">Trang <strong>{pagination.page}</strong> / {pagination.totalPages}</span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            aria-label="Trang sau"
          >
            <ChevronRight size={17} />
          </button>
        </div>
      </nav>
    </div>
  );
}

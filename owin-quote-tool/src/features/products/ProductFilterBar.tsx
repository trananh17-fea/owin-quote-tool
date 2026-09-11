import { Search } from 'lucide-react';

/** Thanh lọc danh mục: tìm theo chữ + chọn nhóm sản phẩm. */
export function ProductFilterBar({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories,
}: {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  categories: string[];
}) {
  return (
    <div className="filter-card">
      <div className="field filter-search">
        <label htmlFor="product-search">
          <Search size={14} aria-hidden="true" /> Tìm sản phẩm
        </label>
        <input
          id="product-search"
          className="input"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Tìm theo tên hoặc nhóm sản phẩm..."
        />
      </div>
      <div className="field">
        <label htmlFor="product-category">Nhóm sản phẩm</label>
        <select
          id="product-category"
          className="input"
          value={selectedCategory}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="">Tất cả nhóm sản phẩm</option>
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES, PRODUCTS, CATEGORY_EMOJI } from '../data/store';
import { useCart } from '../context/CartContext';
import { formatPrice } from '../utils/format';

export default function ProductGrid() {
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const { addItem } = useCart();

  useEffect(() => {
    const handler = (e) => setCategory(e.detail);
    window.addEventListener('select-category', handler);
    return () => window.removeEventListener('select-category', handler);
  }, []);

  const filtered = useMemo(() => {
    return PRODUCTS.filter((p) => {
      const matchCat = category === 'all' || p.category === category;
      const matchSearch =
        !search.trim() ||
        p.name.toLowerCase().includes(search.trim().toLowerCase());
      return matchCat && matchSearch;
    });
  }, [category, search]);

  return (
    <section id="shop" className="section shop-section">
      <div className="shop-header">
        <div className="container">
          <p className="section-eyebrow light">Products</p>
          <h2 className="section-title light">상품 목록</h2>
        </div>
      </div>
      <div className="container shop-body">
        <div className="shop-toolbar">
          <input
            type="search"
            className="search-input"
            placeholder="상품명 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="category-tabs">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={category === c.id ? 'active' : ''}
                onClick={() => setCategory(c.id)}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="product-grid">
          {filtered.map((p) => (
            <article key={p.id} className="product-card">
              <div className="product-thumb">
                {CATEGORY_EMOJI[p.category] || '🛒'}
              </div>
              {p.badge && <span className="product-badge">{p.badge}</span>}
              <p className="product-cat">{p.category}</p>
              <h3>{p.name}</h3>
              <p className="product-desc">{p.description}</p>
              <div className="product-footer">
                <div>
                  <span className="product-price">{formatPrice(p.price)}</span>
                  <span className="product-unit">/ {p.unit}</span>
                </div>
                <button type="button" className="btn-add" onClick={() => addItem(p)}>
                  담기
                </button>
              </div>
            </article>
          ))}
        </div>
        {filtered.length === 0 && <p className="empty-msg">검색 결과가 없습니다.</p>}
      </div>
    </section>
  );
}

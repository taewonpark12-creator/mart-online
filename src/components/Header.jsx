import { useCart } from '../context/CartContext';
import { STORE } from '../data/store';

export default function Header() {
  const { itemCount, setCartOpen } = useCart();

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="header">
      <div className="header-inner">
        <a
          href="#"
          className="logo"
          onClick={(e) => {
            e.preventDefault();
            scrollTo('hero');
          }}
        >
          <span className="logo-mark">🌿</span>
          <span className="logo-text">
            <strong>{STORE.name}</strong>
            <small>{STORE.nameEn}</small>
          </span>
        </a>
        <nav className="nav">
          <button type="button" onClick={() => scrollTo('hero')}>
            홈
          </button>
          <button type="button" onClick={() => scrollTo('shop')}>
            상품 목록
          </button>
          <button type="button" onClick={() => scrollTo('about')}>
            마트 정보
          </button>
        </nav>
        <button
          type="button"
          className="cart-btn"
          onClick={() => setCartOpen(true)}
          aria-label="장바구니"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="21" r="1" />
            <circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          {itemCount > 0 && <span className="cart-badge">{itemCount > 99 ? '99+' : itemCount}</span>}
        </button>
      </div>
    </header>
  );
}

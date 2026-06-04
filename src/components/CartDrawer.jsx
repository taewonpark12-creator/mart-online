import { useCart } from '../context/CartContext';
import { STORE } from '../data/store';
import { formatPrice } from '../utils/format';

export default function CartDrawer() {
  const {
    items,
    itemCount,
    subtotal,
    total,
    cartOpen,
    setCartOpen,
    setOrderOpen,
    updateQty,
    removeItem,
    minDeliveryAmount,
  } = useCart();

  if (!cartOpen) return null;

  return (
    <div className="overlay" onClick={() => setCartOpen(false)}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="drawer-header">
          <h2>장바구니 ({itemCount})</h2>
          <button type="button" className="close-btn" onClick={() => setCartOpen(false)}>
            ×
          </button>
        </div>

        {items.length === 0 ? (
          <p className="drawer-empty">장바구니가 비어 있습니다.</p>
        ) : (
          <>
            <ul className="cart-list">
              {items.map((i) => (
                <li key={i.id} className="cart-item">
                  <div className="cart-item-info">
                    <strong>{i.name}</strong>
                    <span className="cart-meta">
                      {formatPrice(i.price)} / {i.unit}
                    </span>
                    <div className="qty-control">
                      <button type="button" onClick={() => updateQty(i.id, -1)}>−</button>
                      <span>{i.qty}</span>
                      <button type="button" onClick={() => updateQty(i.id, 1)}>+</button>
                    </div>
                  </div>
                  <button type="button" className="remove-btn" onClick={() => removeItem(i.id)}>
                    삭제
                  </button>
                </li>
              ))}
            </ul>
            <div className="cart-summary">
              <div className="summary-row">
                <span>상품 합계</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="summary-row">
                <span>결제</span>
                <span className="onsite">현장 결제</span>
              </div>
              <div className="summary-row total">
                <span>총 결제금액</span>
                <span>{formatPrice(total)}</span>
              </div>
              <p className="delivery-hint">
                배달 시 최소 {formatPrice(minDeliveryAmount)} 이상 주문 가능
              </p>
              <button
                type="button"
                className="btn btn-forest btn-block"
                disabled={items.length === 0}
                onClick={() => {
                  setCartOpen(false);
                  setOrderOpen(true);
                }}
              >
                주문하기
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

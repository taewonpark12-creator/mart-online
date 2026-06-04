import { STORE } from '../data/store';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <div className="footer-brand">
            <span>🌿</span>
            <strong>{STORE.name}</strong>
          </div>
          <p>신선한 식료품, 야채, 청과를 합리적인 가격에 제공하는 한사랑마트입니다.</p>
        </div>
        <div>
          <h4>마트 정보</h4>
          <ul>
            <li>📍 {STORE.address}</li>
            <li>📞 {STORE.phone} / {STORE.phoneMobile}</li>
            <li>🕐 {STORE.hours}</li>
          </ul>
        </div>
        <div>
          <h4>주문 안내</h4>
          <ul className="notice-list">
            <li>결제는 현장에서 진행됩니다.</li>
            <li>배달 가능 지역: 반경 {STORE.deliveryRadiusKm}km 이내</li>
            <li>배달 최소 주문금액: {STORE.minDeliveryAmount.toLocaleString()}원</li>
            <li>주문 후 전화 확인이 있을 수 있습니다.</li>
          </ul>
        </div>
      </div>
      <p className="footer-copy">© {new Date().getFullYear()} {STORE.name}. All rights reserved.</p>
    </footer>
  );
}

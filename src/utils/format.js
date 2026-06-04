import { STORE } from '../data/store';

export function formatPrice(n) {
  return n.toLocaleString('ko-KR') + '원';
}

export function generateOrderNumber() {
  const d = new Date();
  const date =
    String(d.getFullYear()) +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `HS-${date}-${rand}`;
}

export function buildOrderMessage(order, items, total) {
  const deliveryLabel = order.deliveryType === '배달' ? '배달' : '픽업';
  const lines = items.map(
    (i) =>
      `  · ${i.name} (${i.unit}) × ${i.qty} = ${(i.price * i.qty).toLocaleString()}원`
  );
  return [
    `[${STORE.name} 온라인 주문]`,
    `주문번호: ${order.orderNumber}`,
    '',
    `▶ 주문자: ${order.customerName}`,
    `▶ 연락처: ${order.phone}`,
    `▶ 수령: ${deliveryLabel}`,
    order.deliveryType === '배달' && order.address ? `▶ 주소: ${order.address}` : '',
    order.note ? `▶ 요청: ${order.note}` : '',
    '',
    '▶ 주문 상품',
    ...lines,
    '',
    `총 결제예정: ${total.toLocaleString()}원 (현장 결제)`,
  ]
    .filter(Boolean)
    .join('\n');
}

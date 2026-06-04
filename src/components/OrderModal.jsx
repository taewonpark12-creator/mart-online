'use client';

import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { STORE } from '../data/store';
import { buildOrderMessage, formatPrice, generateOrderNumber } from '../utils/format';

export default function OrderModal() {
  const { items, total, orderOpen, setOrderOpen, clearCart, minDeliveryAmount } = useCart();

  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    deliveryType: '픽업',
    address: '',
    note: '',
    pickupTime: '09:30',
  });
  const [submitted, setSubmitted] = useState(null);

  if (!orderOpen) return null;

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const deliveryBlocked =
    form.deliveryType === '배달' && total < minDeliveryAmount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (deliveryBlocked) return;

    const fulfillmentType = form.deliveryType === '배달' ? 'DELIVERY' : 'PICKUP';

    const orderData = {
      customerName: form.customerName,
      customerPhone: form.phone,
      fulfillmentType,
      deliveryAddress: form.deliveryType === '배달' ? form.address : undefined,
      pickupTime: form.deliveryType === '픽업' ? form.pickupTime : undefined,
      memo: form.note,
      paymentMethod: form.deliveryType === '배달' ? 'ONSITE_CASH' : undefined,
      outOfStockPolicy: 'CONTACT',
      items: items.map((item) => ({
        productId: item.id,
        quantity: item.qty,
      })),
    };

    try {
      console.log('주문 데이터:', orderData);
      console.log('카트 아이템:', items);

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      const responseText = await res.text();
      console.log('API 응답 상태:', res.status);
      console.log('API 응답 내용:', responseText);

      if (!res.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { error: responseText || '주문 처리 중 오류가 발생했습니다.' };
        }
        alert(errorData.error || '주문 처리 중 오류가 발생했습니다.');
        return;
      }

      const data = JSON.parse(responseText);
      const order = { ...form, orderNumber: data.orderNumber };
      const msg = buildOrderMessage(order, items, total);
      navigator.clipboard?.writeText(msg).catch(() => {});

      try {
        const saved = JSON.parse(localStorage.getItem('hansarang-orders') || '[]');
        saved.unshift({
          orderNumber: data.orderNumber,
          ...form,
          items,
          total,
          status: '접수',
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem('hansarang-orders', JSON.stringify(saved.slice(0, 20)));
      } catch {
        /* ignore */
      }

      setSubmitted(order);
    } catch (error) {
      console.error('주문 제출 오류:', error);
      alert('주문 처리 중 오류가 발생했습니다.');
    }
  };

  const close = () => {
    setOrderOpen(false);
    if (submitted) {
      clearCart();
      setSubmitted(null);
      setForm({
        customerName: '',
        phone: '',
        deliveryType: '픽업',
        address: '',
        note: '',
        pickupTime: '09:30',
      });
    }
  };

  const phoneMain = STORE.phone.replace(/-/g, '');
  const smsBody = submitted
    ? encodeURIComponent(buildOrderMessage(submitted, items, total))
    : '';

  return (
    <div className="overlay overlay-center" onClick={close}>
      <div className="modal order-modal" onClick={(e) => e.stopPropagation()}>
        {!submitted ? (
          <>
            <p className="section-eyebrow">Order</p>
            <h2>주문하기</h2>
            <form onSubmit={handleSubmit} className="order-form">
              <fieldset>
                <legend>주문자 정보</legend>
                <label>
                  이름 *
                  <input
                    required
                    value={form.customerName}
                    onChange={(e) => update('customerName', e.target.value)}
                    placeholder="홍길동"
                  />
                </label>
                <label>
                  연락처 *
                  <input
                    required
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    placeholder="010-1234-5678"
                  />
                </label>
              </fieldset>

              <fieldset>
                <legend>수령 방법</legend>
                <div className="method-grid">
                  {['픽업', '배달'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={`method-btn ${form.deliveryType === type ? 'active' : ''}`}
                      onClick={() => update('deliveryType', type)}
                    >
                      <span>{type === '픽업' ? '🏪' : '🚚'}</span>
                      <strong>{type}</strong>
                      <small>
                        {type === '픽업' ? '매장 방문 수령' : '배달 주소로 배송'}
                      </small>
                    </button>
                  ))}
                </div>
                {form.deliveryType === '배달' && (
                  <>
                    <label>
                      배달 주소 *
                      <input
                        required
                        value={form.address}
                        onChange={(e) => update('address', e.target.value)}
                        placeholder="인천광역시 미추홀구 ..."
                      />
                    </label>
                    <p className="form-hint">
                      배달 가능 지역: 반경 {STORE.deliveryRadiusKm}km 이내 / 최소 주문{' '}
                      {formatPrice(minDeliveryAmount)}
                    </p>
                    {deliveryBlocked && (
                      <p className="form-error">
                        배달 주문은 {formatPrice(minDeliveryAmount)} 이상이어야 합니다.
                      </p>
                    )}
                  </>
                )}
                {form.deliveryType === '픽업' && (
                  <>
                    <label>
                      픽업 예정 시각 *
                      <select
                        required
                        value={form.pickupTime}
                        onChange={(e) => update('pickupTime', e.target.value)}
                      >
                        <option value="09:30">오전 09:30</option>
                        <option value="10:00">오전 10:00</option>
                        <option value="10:30">오전 10:30</option>
                        <option value="11:00">오전 11:00</option>
                        <option value="11:30">오전 11:30</option>
                        <option value="12:00">오후 12:00</option>
                        <option value="12:30">오후 12:30</option>
                        <option value="13:00">오후 13:00</option>
                        <option value="13:30">오후 13:30</option>
                        <option value="14:00">오후 14:00</option>
                        <option value="14:30">오후 14:30</option>
                        <option value="15:00">오후 15:00</option>
                        <option value="15:30">오후 15:30</option>
                        <option value="16:00">오후 16:00</option>
                        <option value="16:30">오후 16:30</option>
                        <option value="17:00">오후 17:00</option>
                        <option value="17:30">오후 17:30</option>
                        <option value="18:00">오후 18:00</option>
                        <option value="18:30">오후 18:30</option>
                        <option value="19:00">오후 19:00</option>
                        <option value="19:30">오후 19:30</option>
                        <option value="20:00">오후 20:00</option>
                        <option value="20:30">오후 20:30</option>
                        <option value="21:00">오후 21:00</option>
                        <option value="21:30">오후 21:30</option>
                        <option value="22:00">오후 22:00</option>
                        <option value="22:30">오후 22:30</option>
                      </select>
                    </label>
                    <div className="pickup-box">
                      <strong>{STORE.name}</strong>
                      <p>{STORE.address}</p>
                      <p>{STORE.hours}</p>
                    </div>
                  </>
                )}
              </fieldset>

              <label>
                요청사항
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(e) => update('note', e.target.value)}
                  placeholder="배달 시 문 앞에 놓아주세요 / 특정 상품 대체 요청 등"
                />
              </label>

              <div className="order-summary-box">
                <h3>주문 내역</h3>
                <ul>
                  {items.map((i) => (
                    <li key={i.id}>
                      <span>
                        {i.name} × {i.qty}
                      </span>
                      <span>{formatPrice(i.price * i.qty)}</span>
                    </li>
                  ))}
                </ul>
                <div className="order-total-line">
                  <span>총 결제금액</span>
                  <strong>{formatPrice(total)}</strong>
                </div>
                <p className="pay-note">💳 결제는 상품 수령 시 현장에서 진행됩니다.</p>
              </div>

              <button
                type="submit"
                className="btn btn-forest btn-block"
                disabled={deliveryBlocked}
              >
                주문 완료하기
              </button>
            </form>
          </>
        ) : (
          <div className="order-success text-center">
            <div className="success-icon">✓</div>
            <h2 className="mb-2">주문이 완료되었습니다</h2>
            
            {/* 주문번호 노출 줄임 및 안내 문구 추가 */}
            <div className="bg-gray-50 p-4 rounded-xl mb-4 border border-dashed border-gray-200">
              <p className="text-sm text-gray-500 mb-1">주문번호</p>
              <p className="text-lg font-mono font-bold text-gray-800">{submitted.orderNumber}</p>
              <p className="text-xs text-green-600 font-bold mt-2">
                ✨ 번호를 외우지 않으셔도 됩니다!<br/>
                입력하신 연락처({submitted.phone})로 조회가 가능합니다.
              </p>
            </div>

            <p className="mb-4 text-sm text-gray-600">주문 내용이 클립보드에 복사되었습니다.</p>
            
            <div className="success-actions">
              <a href={`tel:${phoneMain}`} className="btn btn-forest">
                전화로 확인
              </a>
              <a href={`sms:${phoneMain}?body=${smsBody}`} className="btn btn-outline">
                문자로 보내기
              </a>
            </div>
            
            <div className="pay-notice mt-6 text-left">
              <h4 className="font-bold mb-2">현장 결제 안내</h4>
              <ul className="text-xs space-y-1 text-gray-500 list-disc ml-4">
                <li>결제는 상품 수령 시 현장에서 진행됩니다.</li>
                <li>카드 및 현금 결제 모두 가능합니다.</li>
                <li>주문 확인 후 마트에서 연락드릴 수 있습니다.</li>
              </ul>
            </div>
            
            <button type="button" className="btn btn-outline btn-block mt-6" onClick={close}>
              쇼핑 계속하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
import { STORE } from "@/lib/store";
import { orderItemBarcode, orderItemName } from "@/lib/order-item";
import { sortOrderItemsByProductCategory } from "@/lib/order-item-category-sort";
import { RECEIPT_FONT, RECEIPT_LAYOUT } from "@/lib/receipt-html";
import {
  BANK_ACCOUNT,
  FULFILLMENT_TYPE_LABEL,
  formatPaymentMethodLabel,
  formatPickupTimeLabel,
  formatPrice,
  type OrderStatus,
  type PaymentMethod,
  type FulfillmentType,
} from "@/lib/types";

export type ReceiptOrder = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  fulfillmentType: FulfillmentType;
  deliveryAddress: string;
  deliveryEntrance?: string | null;
  pickupTime?: string | null;
  paymentMethod: PaymentMethod | null;
  memo: string | null;
  outOfStockPolicy?: string | null;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  items: {
    quantity: number;
    unitPrice: number;
    productName: string;
    itemStatus?: "ACTIVE" | "CANCELLED" | string | null;
    product?: { name: string; barcode?: string | null; category?: string | null } | null;
  }[];
};

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="text-[11px] leading-snug my-0.5" style={{ wordBreak: "keep-all" }}>
      <span className="font-bold">{label}</span> : {children}
    </p>
  );
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 8 && digits.startsWith("050")) {
    return `${digits.slice(0, 4)}-****-****`;
  }
  if (digits.length >= 10) {
    return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
  }
  return phone;
}

export function OrderReceipt({ order }: { order: ReceiptOrder }) {
  const date = new Date(order.createdAt);
  const p = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${date.getFullYear()}.${p(date.getMonth() + 1)}.${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
  const isPickup = order.fulfillmentType === "PICKUP";
  const sortedItems = sortOrderItemsByProductCategory(order.items);
  const activeItems = sortedItems.filter((item) => item.itemStatus !== "CANCELLED");
  const cancelledItems = sortedItems.filter((item) => item.itemStatus === "CANCELLED");
  const activeTotalAmount = activeItems.reduce(
    (sum, item) => sum + Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0),
    0,
  );

  return (
    <div
      className="text-black font-sans"
      style={{ fontSize: `${RECEIPT_FONT.base}px`, maxWidth: `${RECEIPT_LAYOUT.paperWidthMm}mm` }}
    >
      <InfoRow label="날짜">{dateStr}</InfoRow>
      <InfoRow label="주문번호">
        <b>{order.orderNumber}</b>
      </InfoRow>
      <hr className="border-dashed border-black my-2" />

      <InfoRow label="주문자">
        <b>{order.customerName}</b>
      </InfoRow>
      <InfoRow label="수령 방식">
        <b>{FULFILLMENT_TYPE_LABEL[order.fulfillmentType]}</b>
      </InfoRow>
      {isPickup ? (
        <>
          <InfoRow label="픽업 시간">
            <b>{order.pickupTime ? formatPickupTimeLabel(order.pickupTime) : "미정"}</b>
          </InfoRow>
        </>
      ) : (
        <>
          <InfoRow label="배달주소">
            <b>{order.deliveryAddress}</b>
          </InfoRow>
          <InfoRow label="공동현관 출입정보">
            {order.deliveryEntrance?.trim() || "없음"}
          </InfoRow>
        </>
      )}
      <InfoRow label="연락처">{maskPhone(order.customerPhone)}</InfoRow>
      <InfoRow label={isPickup ? "요청사항" : "요청사항"}>
        {order.memo?.trim() || "없음"}
      </InfoRow>
      {order.outOfStockPolicy && (
        <InfoRow label="품절 시 처리">
          {order.outOfStockPolicy === "CONTACT" ? "연락바람" : order.outOfStockPolicy === "CANCEL_ONLY" ? "품절된 상품만 취소" : order.outOfStockPolicy === "SUBSTITUTE" ? "대체상품으로 받기" : order.outOfStockPolicy}
        </InfoRow>
      )}
      <hr className="border-dashed border-black my-2" />

      <InfoRow label="결제방식">
        <b>{formatPaymentMethodLabel(order.paymentMethod, order.fulfillmentType)}</b>
        {order.paymentMethod === "BANK_TRANSFER" && (
          <span className="block text-[10px] font-normal mt-0.5">{BANK_ACCOUNT.display}</span>
        )}
      </InfoRow>
      <hr className="border-dashed border-black my-2" />

      <table
        className="w-full border-collapse"
        style={{ tableLayout: "fixed", fontSize: `${RECEIPT_FONT.row}px` }}
      >
        <colgroup>
          <col />
          <col style={{ width: `${RECEIPT_LAYOUT.colQty}px` }} />
          <col style={{ width: `${RECEIPT_LAYOUT.colUnit}px` }} />
          <col style={{ width: `${RECEIPT_LAYOUT.colAmount}px` }} />
        </colgroup>
        <thead>
          <tr className="font-bold text-[11px]">
            <th className="text-left pb-1">상품명</th>
            <th className="text-left pb-1">수량</th>
            <th className="text-right pb-1">단가</th>
            <th className="text-right pb-1">금액</th>
          </tr>
        </thead>
        {activeItems.map((item, index) => (
          <tbody key={index}>
            <tr>
              <td
                colSpan={4}
                className="font-bold pb-0.5"
                style={{ fontSize: `${RECEIPT_FONT.itemName}px`, wordBreak: "keep-all" }}
              >
                {index + 1}) <b>{orderItemName(item)}</b>
              </td>
            </tr>
            {orderItemBarcode(item) && (
              <tr>
                <td colSpan={4} className="text-[9px] pb-1 tracking-wide">
                  {orderItemBarcode(item)}
                </td>
              </tr>
            )}
            <tr>
              <td />
              <td className="text-left whitespace-nowrap pb-2.5">{item.quantity}</td>
              <td className="text-right whitespace-nowrap pb-2.5">
                {formatPrice(item.unitPrice)}
              </td>
              <td className="text-right whitespace-nowrap pb-2.5">
                {formatPrice(item.unitPrice * item.quantity)}
              </td>
            </tr>
          </tbody>
        ))}
      </table>
      <hr className="border-dashed border-black my-2" />

      <p
        className="text-right font-extrabold mt-2 pt-2 border-t border-dashed border-black pr-0.5"
        style={{ fontSize: `${RECEIPT_FONT.total}px` }}
      >
        합계 {formatPrice(activeTotalAmount)}
      </p>

      {cancelledItems.length > 0 && (
        <div className="mt-2 border-t border-dashed border-black pt-2 text-[10px] leading-snug">
          <p className="font-bold">품절취소 상품</p>
          {cancelledItems.map((item, index) => (
            <p key={`${item.productName}-${index}`}>
              - {orderItemName(item)} {item.quantity}개
            </p>
          ))}
        </div>
      )}

      <hr className="border-dashed border-black my-2" />
      <p className="text-center text-[9px]">
        {STORE.name}
        <br />
        {STORE.phone} / {STORE.phoneMobile}
      </p>
    </div>
  );
}

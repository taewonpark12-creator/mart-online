import { STORE } from "@/lib/store";
import {
  BANK_ACCOUNT,
  FULFILLMENT_TYPE_LABEL,
  formatPaymentMethodLabel,
  formatPickupTimeLabel,
  formatPrice,
} from "@/lib/types";
import type { ReceiptOrder } from "@/components/admin/OrderReceipt";
import { orderItemBarcode, orderItemName } from "@/lib/order-item";
import { sortOrderItemsByProductCategory } from "@/lib/order-item-category-sort";

export type { ReceiptOrder };

const OUT_OF_STOCK_POLICY_LABEL: Record<string, string> = {
  SUBSTITUTE: "대체상품으로 받기",
  CANCEL_ONLY: "품절된 상품만 취소",
  CONTACT: "연락바람",
};

export const RECEIPT_FONT = {
  base: 18,
  itemName: 18,
  barcode: 11,
  row: 18,
  total: 20,
  footer: 11,
};

export const RECEIPT_LAYOUT = {
  paperWidthMm: 78
  ,
  colQty: 48,
  colUnit: 65,
  colAmount: 70,
};

function esc(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatReceiptDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function infoLine(label: string, value: string, bold = false) {
  const val = bold ? `<b>${value}</b>` : value;
  return `<p class="info"><span class="info-label">${label}</span> : ${val}</p>`;
}

export function buildReceiptPrintHtml(order: ReceiptOrder) {
  const F = RECEIPT_FONT;
  const L = RECEIPT_LAYOUT;
  const date = formatReceiptDate(order.createdAt);
  const isPickup = order.fulfillmentType === "PICKUP";
  const deliveryMemo = order.memo?.trim() ? esc(order.memo.trim()) : "없음";
  const entrance = order.deliveryEntrance?.trim()
    ? esc(order.deliveryEntrance.trim())
    : "없음";

  const fulfillmentBlock = isPickup
    ? `
  ${infoLine("수령 방식", esc(FULFILLMENT_TYPE_LABEL.PICKUP), true)}
  ${infoLine("픽업 시간", esc(order.pickupTime ? formatPickupTimeLabel(order.pickupTime) : "미정"), true)}`
    : `
  ${infoLine("수령 방식", esc(FULFILLMENT_TYPE_LABEL.DELIVERY), true)}
  ${infoLine("배달주소", esc(order.deliveryAddress), true)}
  ${infoLine("공동현관 출입정보", entrance, true)}`;

  const paymentLabel = esc(formatPaymentMethodLabel(order.paymentMethod, order.fulfillmentType));
  const bankExtra =
    order.paymentMethod === "BANK_TRANSFER"
      ? `<br /><span style="font-size:10px;">${esc(BANK_ACCOUNT.display)}</span>`
      : "";

  const colStyle = `table-layout:fixed;width:100%;border-collapse:collapse;font-size:${F.row}px;`;
  const colGroup = `
    <colgroup>
      <col />
      <col style="width:${L.colQty}px" />
      <col style="width:${L.colUnit}px" />
      <col style="width:${L.colAmount}px" />
    </colgroup>`;

  const sortedItems = sortOrderItemsByProductCategory(order.items);
  const activeItems = sortedItems.filter((item) => item.itemStatus !== "CANCELLED");
  const cancelledItems = sortedItems.filter((item) => item.itemStatus === "CANCELLED");
  const activeTotalAmount = activeItems.reduce(
    (sum, item) => sum + Number(item.unitPrice ?? 0) * Number(item.quantity ?? 0),
    0,
  );

  const itemsHtml = activeItems
    .map((item, index) => {
      const lineTotal = item.unitPrice * item.quantity;
      const barcode = orderItemBarcode(item) || item.product?.barcode || "";
      const barcodeRow = barcode
        ? `<tr class="item-barcode"><td colspan="4" style="padding-left:4px;"><b>${esc(barcode)}</b></td></tr>`
        : "";

      return `
      <tbody class="item-group">
        <tr class="item-name">
          <td colspan="4">${index + 1}) <b>${esc(orderItemName(item))}</b></td>
        </tr>
        ${barcodeRow}
        <tr class="item-values">
          <td></td>
          <td class="v-qty">${item.quantity}</td>
          <td class="v-unit">${formatPrice(item.unitPrice)}</td>
          <td class="v-amt">${formatPrice(lineTotal)}</td>
        </tr>
      </tbody>`;
    })
    .join("");
  const cancelledItemsHtml = cancelledItems.length
    ? `
  <div class="cancelled-items">
    <p><b>품절취소 상품</b></p>
    ${cancelledItems.map((item) => `<p>- ${esc(orderItemName(item))} ${item.quantity}개</p>`).join("")}
  </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>영수증</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    @page { size:80mm auto; margin:2mm 3mm; }
    html, body {
      width:${L.paperWidthMm}mm;
      max-width:${L.paperWidthMm}mm;
      font-family:"Malgun Gothic","Apple SD Gothic Neo",sans-serif;
      font-size:${F.base}px;
      line-height:1.45;
      color:#000;
      background:#fff;
    }
    body { padding: 2mm 2mm 4mm 2mm; }
    .hr { border:none; border-top:1px dashed #000; margin:7px 0; }
    .info {
      margin:3px 0;
      margin-right:5px;
      width:calc(100% - 5px);
      font-size:${F.base}px;
      overflow-wrap:break-word;
      word-break:break-all;
      white-space:normal;
      line-height:1.4;
    }
    .info-label { font-weight:400; white-space:nowrap; }
    .items-table { ${colStyle} margin-right:5px; width:calc(100% - 5px); }
    .items-table thead th {
      font-weight:700;
      font-size:13px;
      padding-bottom:5px;
      vertical-align:bottom;
      border-bottom:1px solid #000;
    }
    .items-table thead .h-name { text-align:left; }
    .items-table thead .h-unit,
    .items-table thead .h-amt { text-align:right; }
    .items-table thead .h-qty { text-align:left; }
    .item-group { page-break-inside:avoid; }
    .item-name td {
      font-size:${F.itemName}px;
      font-weight:700;
      overflow-wrap:break-word;
      word-break:break-all;
      line-height:1.35;
      padding:8px 0 2px 0;
      vertical-align:top;
    }
    .item-barcode td {
      font-size:${F.barcode}px;
      font-weight:800;
      color:#000;
      line-height:1.3;
      padding:0 0 2px 0;
      letter-spacing:0.05em;
    }
    .item-values td { padding-bottom:6px; vertical-align:top; }
    .item-values .v-unit,
    .item-values .v-amt { text-align:right; white-space:nowrap; }
    .item-values .v-qty { text-align:left; white-space:nowrap; }
    .total {
      text-align:right;
      font-size:${F.total}px;
      font-weight:800;
      margin-top:8px;
      padding-top:6px;
      margin-right:35px;
      border-top:1px dashed #000;
    }
    .footer {
      text-align:center;
      font-size:${F.footer}px;
      margin-top:10px;
      line-height:1.4;
    }
    .cancelled-items {
      margin-top:8px;
      padding-top:6px;
      border-top:1px dashed #000;
      font-size:11px;
      line-height:1.35;
    }
  </style>
</head>
<body>
  ${infoLine("날짜", esc(date))}
  <hr class="hr" />

  ${infoLine("주문자", esc(order.customerName), true)}
  ${fulfillmentBlock}
  ${infoLine("연락처", esc(maskPhone(order.customerPhone)),true)}
  ${infoLine(isPickup ? "요청사항" : "요청사항", deliveryMemo, true)}
  ${infoLine("품절 시 처리", esc(OUT_OF_STOCK_POLICY_LABEL[order.outOfStockPolicy || "CONTACT"] || "연락바람"), true)}
  <hr class="hr" />

  <p class="info"><span class="info-label">결제방식</span> : <b>${paymentLabel}</b>${bankExtra}</p>
  <hr class="hr" />

  <table class="items-table">
    ${colGroup}
    <thead>
      <tr>
        <th class="h-name">상품명</th>
        <th class="h-qty">수량</th>
        <th class="h-unit">단가</th>
        <th class="h-amt">금액</th>
      </tr>
    </thead>
    ${itemsHtml}
  </table>
  <hr class="hr" style="margin-top:2px;" />

  <div class="total">합계 ${formatPrice(activeTotalAmount)}</div>

  ${cancelledItemsHtml}

  <hr class="hr" />
  <div class="footer">
    ${esc(STORE.name)}<br />
    ${esc(STORE.phone)} / ${esc(STORE.phoneMobile)}
  </div>
</body>
</html>`;
}

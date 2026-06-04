/** 주문 시점 상품명 (상품 삭제 후에도 표시) */
export function orderItemName(item: {
  productName?: string | null;
  product?: { name: string } | null;
}) {
  return item.product?.name ?? item.productName?.trim() ?? "삭제된 상품";
}

export function orderItemBarcode(item: { product?: { barcode?: string | null } | null }) {
  return item.product?.barcode?.trim() || null;
}

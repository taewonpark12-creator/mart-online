import { buildReceiptPrintHtml } from "@/lib/receipt-html";
import type { ReceiptOrder } from "@/lib/receipt-html";

export type { ReceiptOrder };

let isPrinting = false;

/** 영수증 1장 인쇄 (인라인 HTML + 보이는 크기 iframe) */
export function printReceiptNow(order: ReceiptOrder) {
  if (isPrinting) return;
  isPrinting = true;

  const html = buildReceiptPrintHtml(order);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "영수증 인쇄");
  iframe.style.cssText =
    "position:fixed;left:0;top:0;width:80mm;height:100vh;border:0;z-index:99999;opacity:0.01;pointer-events:none;";

  const finish = () => {
    if (iframe.parentNode) iframe.remove();
    isPrinting = false;
  };

  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  if (!win) {
    finish();
    return;
  }

  const doc = win.document;
  doc.open();
  doc.write(html);
  doc.close();

  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    try {
      win.focus();
      setTimeout(() => {
        try {
          win.print();
        } catch (e) {
          console.error("[print-receipt] print() failed", e);
          alert("인쇄를 시작할 수 없습니다. 다시 시도해주세요.");
        }
        finish();
      }, 600);
    } catch (e) {
      console.error("[print-receipt] focus() failed", e);
      alert("인쇄를 시작할 수 없습니다. 다시 시도해주세요.");
      finish();
    }
  };

  // Use requestAnimationFrame to ensure rendering is complete
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      iframe.onload = () => setTimeout(doPrint, 100);
      setTimeout(doPrint, 300);
    });
  });

  // Fallback timeout to ensure isPrinting is always released
  setTimeout(finish, 10000);
}

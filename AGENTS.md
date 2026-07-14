# AGENTS.md

## Project Overview

This repository is the live production online ordering site for 한사랑마트.

- Stack: Next.js App Router, TypeScript, React, Prisma, Tailwind CSS.
- Deployment: Vercel. Pushes to GitHub are expected to trigger Vercel deployment.
- Local path: `C:\Users\Administrator\mart-online`.
- Main customer domain: `lovemart.kr`.
- Legacy host redirect: `src/middleware.ts` redirects `lovemart.vercel.app` to `https://lovemart.kr`, except `/api/*`.
- Current Prisma datasource in code: PostgreSQL (`prisma/schema.prisma`).

This is an operating service, not a greenfield project. Prefer stability, small fixes, and predictable behavior over broad rewrites.

## Operating Priorities

1. Fix production errors.
2. Protect order creation and order data integrity.
3. Keep new-order notifications reliable.
4. Reduce Vercel Function, Fluid Active CPU, and image optimization usage.
5. Improve mobile usability.
6. Keep the UX friendly for older customers.
7. Improve online order conversion.
8. Make small UI improvements.

Avoid unnecessary new features, large refactors, extra polling, extra API calls, and new dependencies unless the user explicitly asks and the benefit is clear.

## Core Areas

- Customer home: `src/app/page.tsx`.
- Product APIs: `src/app/api/products/route.ts`, `src/app/api/products/home/route.ts`, shared query helper `src/lib/product-query.ts`.
- Product card/UI: `src/components/ProductCard.tsx`, `src/components/HomeProductSection.tsx`, `src/components/RecommendedProducts.tsx`, `src/components/OnlineExclusiveProducts.tsx`, `src/components/PopularProducts.tsx`.
- Cart: `src/app/cart/page.tsx`, `src/contexts/CartContext.tsx`, `src/lib/cart-price-sync.ts`.
- Checkout: `src/app/checkout/page.tsx`.
- Order creation: `src/app/api/orders/route.ts`.
- Order complete/check: `src/app/order-complete/page.tsx`, `src/app/order-check/page.tsx`, `src/app/api/orders/check/route.ts`.
- Admin orders: `src/app/admin/orders/page.tsx`, `src/app/api/admin/orders/*`.
- Admin products: `src/app/admin/products/page.tsx`.
- Admin dashboard/stats: `src/app/admin/dashboard/page.tsx`, `src/app/api/admin/stats/route.ts`.
- Flyers: `src/app/flyers/page.tsx`, `src/app/flyers/view/page.tsx`, `src/app/admin/flyers/page.tsx`, `src/app/api/admin/flyers/*`, `src/app/api/admin/upload/route.ts`.
- Telegram: `src/lib/telegram.ts`, `src/app/api/cron/pending-order-reminder/route.ts`.
- Receipts: `src/lib/receipt-html.ts`, `src/lib/print-receipt.tsx`, `src/components/admin/OrderReceipt.tsx`.
- Brand/PWA: `src/lib/brand.ts`, `src/app/manifest.ts`, `src/app/admin/manifest.webmanifest/route.ts`.

## Work Rules

- Read the relevant code before editing. Do not guess.
- Keep changes scoped to the user request.
- Do not touch working order, admin, cart, price sync, notification, Telegram, or deployment logic unless directly requested.
- Do not add polling or API calls casually. Consider Vercel CPU and Function usage first.
- Do not add libraries unless necessary.
- Do not expose customer names, phone numbers, addresses, tokens, passwords, or secrets in logs.
- Be especially careful with order creation, order status changes, payment fields, and receipt output.
- Do not run destructive DB commands unless the user explicitly asks and understands the risk.
- Never run `prisma migrate reset`, `prisma db push --force-reset`, seed scripts, `deleteMany`, truncate, or order-delete scripts for routine work.

## Orders

Prisma enums currently define:

- `PENDING`: 주문접수
- `APPROVED`: 확인완료
- `DELIVERED`: 배송완료
- `CANCELLED`: 취소됨

`src/lib/order-status.ts` allows:

- `PENDING -> APPROVED`
- `PENDING -> CANCELLED`
- `APPROVED -> DELIVERED`

`DELIVERED` and `CANCELLED` are locked. Cancellation is intended for `PENDING` orders only.

Order fields include:

- Fulfillment: `DELIVERY`, `PICKUP`
- Payment: `ONSITE_CARD`, `ONSITE_CASH`, `BANK_TRANSFER`
- Out-of-stock policy: `SUBSTITUTE`, `CANCEL_ONLY`, `CONTACT`
- Item status: `ACTIVE`, `CANCELLED`

Partial item cancellation is handled through `OrderItem.itemStatus = CANCELLED`. Cancelled items should remain visible in history but must be excluded from receipt totals, dashboard sales, and product sales aggregation.

## Order Creation And Validation

`src/app/api/orders/route.ts` is the critical order creation API.

Current behavior:

- Re-fetches products from DB by product id.
- Rejects inactive or out-of-stock products.
- Loads `public/prices.json` through `src/lib/order-pricing.ts`.
- Uses barcode-based price/name sync where possible.
- Rejects orders if submitted item price differs from current synced price.
- Enforces max order quantity.
- Enforces minimum order amount with `src/lib/min-order.ts`.
- Suppresses duplicate orders within a short window using a PostgreSQL advisory lock and recent-order signature.
- Sends Telegram new-order alert after successful non-duplicate order creation.

Minimum order amount is controlled by `src/lib/min-order.ts`:

- Default: `40_000`
- Event override currently in code: `2026-07-04` through `2026-07-15`, amount `30_000`, KST date logic.

Do not hard-code minimum order text or amounts elsewhere.

## Customer UX

The main customer base includes older mobile users.

- Prefer simple screens and clear text.
- Do not make product names, prices, or key buttons too small.
- Keep mobile first, but avoid unnecessary desktop layout changes.
- Avoid unnecessary modals.
- Consider KakaoTalk in-app browser and iOS Safari behavior.
- Preserve existing URL/page navigation principles unless asked otherwise.

## Product And Price Sync

Products are managed in the app DB and identified heavily by barcode.

The app code does not directly connect to POS DB. Current web behavior uses `public/prices.json`:

- Customer/admin display price overlay: `src/contexts/PriceContext.tsx`.
- Cart/checkout price refresh: `src/lib/cart-price-sync.ts`, using `/prices.json?ts=Date.now()`.
- Order creation validation: `src/lib/order-pricing.ts`.
- Bulk barcode registration: `src/app/api/products/bulk/route.ts`.

Operational information says POS price extraction is managed outside the app, under `C:\price-sync` with `update-price.bat`. Keep app-side changes focused on `prices.json` consumption unless the user explicitly asks to modify the external sync process.

Do not add inventory/realtime stock behavior casually. Although `Product.stock` exists, current customer order validation mainly uses `isActive`, `isOutOfStock`, max quantity, barcode, and price sync.

## Vercel And Performance

Vercel usage matters. Avoid changes that increase Function calls, active CPU, server-side image work, or image optimization usage.

Recent important optimization:

- Customer home non-search load was changed from four `/api/products` requests to one `/api/products/home` request.
- Search mode still uses `/api/products?q=...`.

Before adding API calls, polling, cron work, image processing, or background refreshes, check if existing data can be reused.

Admin orders currently separates:

- Order list refresh timer.
- Pending-order notification polling.
- Notification sound repeat timer.

Do not merge these timers accidentally.

## Notifications

Admin browser new-order notification logic lives in `src/app/admin/orders/page.tsx`.

Current concepts:

- Browser sound uses `/notification.mp3`.
- Admin must enable sound with the order notification button because browsers require user interaction.
- Pending count polling uses `/api/admin/orders/pending-count`.
- If any `PENDING` order exists and sound is enabled, notification sound repeats until all pending orders are handled.

Telegram logic lives in `src/lib/telegram.ts`.

- New order: `sendNewOrderTelegramAlert()`.
- Pending reminder summary: `sendPendingOrderReminderTelegramAlert(pendingCount)`.
- Cron endpoint: `src/app/api/cron/pending-order-reminder/route.ts`.

Notification code has had prior stability work; inspect current logic before changing it.

## Receipts

The store uses 80mm receipt printing. Receipt output is operationally important.

Receipt-related code:

- `src/lib/receipt-html.ts`
- `src/lib/print-receipt.tsx`
- `src/components/admin/OrderReceipt.tsx`

Current receipt behavior includes payment method, out-of-stock policy, active item totals, and cancelled-item display. Pickup orders should not show customer delivery address as a delivery address.

Do not casually change receipt layout widths, column alignment, or print CSS without checking 80mm output constraints.

## Images And Flyers

Product image upload and flyer upload are separate. Do not mix the two.

- Product image upload: `src/app/api/admin/upload/product-image/route.ts`
  - 10MB limit.
  - WebP quality 80.
  - Resizes inside 1000x1000.
  - Saves under `public/uploads/products`.

- Flyer upload: `src/app/api/admin/upload/route.ts`
  - 20MB limit.
  - WebP quality 85.
  - Resizes long edge inside 2800px.
  - Uploads to GitHub Contents API under `public/flyers`.

Customer flyer viewing uses normal `img` elements to avoid unwanted Next/Image downscaling in flyer zoom/view flows.

## Admin And Safety

Admin auth is cookie-based in `src/lib/auth.ts` and admin APIs check `isAdminAuthenticated()`.

Order deletion is intentionally restricted to `PENDING` or `CANCELLED` orders in `src/app/api/admin/orders/[id]/route.ts`. Do not make deletion easier in production UI.

Admin dashboard sales should exclude cancelled orders and cancelled order items.

Customer order check is limited to recent orders and masks personal data. `src/app/api/orders/check/route.ts` currently limits lookup to the last 24 hours and includes an in-memory rate limit.

## Deployment

Typical deployment workflow, only when the user explicitly requests it:

```powershell
cd C:\Users\Administrator\mart-online
git status
git add .
git commit -m "update"
git push
```

Do not push, deploy, reset DB, seed DB, or delete data unless explicitly asked.

Build command:

```powershell
npm.cmd run build
```

This runs `prisma generate && next build`.

## Completion Report Checklist

For code changes, report:

- Existing structure checked.
- Changed files.
- File-by-file summary.
- Possible impact on existing behavior.
- Performance impact.
- Verification performed.
- Build result, or why build was not run.
- Manual test steps for the user.

For documentation-only changes, say that no build was run if no runtime code changed.

## Final Principle

This site is used by real customers and store staff. Do not optimize for abstract code beauty at the cost of production safety. Keep changes small, observable, and easy to roll back.

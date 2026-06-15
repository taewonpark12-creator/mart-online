import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";
import type { OrderStatus } from "@/lib/types";
import { canTransition, getTransitionError } from "@/lib/order-status";

type Params = { params: Promise<{ id: string }> };

const VALID_STATUSES: OrderStatus[] = ["PENDING", "PAID", "FAILED", "CANCELED"];

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "?몄쬆???꾩슂?⑸땲??" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { status } = await req.json();

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "?щ컮瑜댁? ?딆? 二쇰Ц ?곹깭?낅땲??" }, { status: 400 });
    }

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "二쇰Ц??李얠쓣 ???놁뒿?덈떎." }, { status: 404 });
    }

    if (!canTransition(existing.status as OrderStatus, status)) {
      return NextResponse.json(
        {
          code: "INVALID_STATUS_TRANSITION",
          error: getTransitionError(existing.status as OrderStatus, status),
        },
        { status: 400 },
      );
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
      include: { items: { include: { product: true } } },
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error("[PATCH /api/orders/[id]]", error);
    return NextResponse.json({ error: "二쇰Ц ?곹깭 蹂寃?以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function serializeAnnouncement<
  T extends { showOnlineOrder?: boolean | null; showPhoneOrder?: boolean | null } | null,
>(announcement: T) {
  if (!announcement) return null;

  return {
    ...announcement,
    showOnlineOrder: announcement.showOnlineOrder ?? true,
    showPhoneOrder: announcement.showPhoneOrder ?? true,
  };
}

export async function GET() {
  try {
    const announcement = await prisma.flyerAnnouncement.findFirst({
      where: {
        isActive: true,
        title: {
          not: "",
        },
        content: {
          not: "",
        },
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        content: true,
        showOnlineOrder: true,
        showPhoneOrder: true,
        updatedAt: true,
      },
    });

    const response = NextResponse.json({
      announcement: serializeAnnouncement(announcement),
    });
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return response;
  } catch (error) {
    console.error("[GET /api/flyers/announcement]", error);
    return jsonNoStore({ error: "Failed to load flyer announcement." }, { status: 500 });
  }
}

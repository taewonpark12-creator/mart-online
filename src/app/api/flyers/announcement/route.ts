import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
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
        updatedAt: true,
      },
    });

    return jsonNoStore({ announcement });
  } catch (error) {
    console.error("[GET /api/flyers/announcement]", error);
    return jsonNoStore({ error: "Failed to load flyer announcement." }, { status: 500 });
  }
}

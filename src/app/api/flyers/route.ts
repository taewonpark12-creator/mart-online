import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET() {
  try {
    const flyers = await prisma.flyer.findMany({
      where: {
        isActive: true,
        imageUrl: {
          not: "",
        },
      },
      orderBy: { order: "asc" },
      select: {
        id: true,
        imageUrl: true,
        order: true,
      },
    });

    const response = NextResponse.json(flyers);
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
    return response;
  } catch (error) {
    console.error("[GET /api/flyers]", error);
    return jsonNoStore({ error: "Failed to load flyers." }, { status: 500 });
  }
}

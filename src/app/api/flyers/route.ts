import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    return NextResponse.json(flyers);
  } catch (error) {
    console.error("[GET /api/flyers]", error);
    return NextResponse.json({ error: "Failed to load flyers." }, { status: 500 });
  }
}

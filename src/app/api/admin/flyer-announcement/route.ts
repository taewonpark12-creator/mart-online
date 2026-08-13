import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isAdminAuthenticated } from "@/lib/auth";

const MAX_TITLE_LENGTH = 80;
const MAX_CONTENT_LENGTH = 1000;

function normalizeText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return jsonNoStore({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const announcement = await prisma.flyerAnnouncement.findFirst({
      orderBy: [
        { isActive: "desc" },
        { updatedAt: "desc" },
      ],
    });

    return jsonNoStore({ announcement });
  } catch (error) {
    console.error("[GET /api/admin/flyer-announcement]", error);
    return jsonNoStore({ error: "홍보문구 조회에 실패했습니다." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return jsonNoStore({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const id = typeof body?.id === "string" ? body.id : "";
    const title = normalizeText(body?.title, MAX_TITLE_LENGTH);
    const content = normalizeText(body?.content, MAX_CONTENT_LENGTH);
    const isActive = Boolean(body?.isActive);

    if (!title) {
      return jsonNoStore({ error: "제목을 입력해주세요." }, { status: 400 });
    }

    if (!content) {
      return jsonNoStore({ error: "내용을 입력해주세요." }, { status: 400 });
    }

    const announcement = await prisma.$transaction(async (tx) => {
      if (isActive) {
        await tx.flyerAnnouncement.updateMany({
          where: id ? { id: { not: id } } : undefined,
          data: { isActive: false },
        });
      }

      if (id) {
        return tx.flyerAnnouncement.update({
          where: { id },
          data: {
            title,
            content,
            isActive,
          },
        });
      }

      return tx.flyerAnnouncement.create({
        data: {
          title,
          content,
          isActive,
        },
      });
    });

    revalidatePath("/flyers");

    return jsonNoStore({ announcement });
  } catch (error) {
    console.error("[POST /api/admin/flyer-announcement]", error);
    return jsonNoStore({ error: "홍보문구 저장에 실패했습니다." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return jsonNoStore({ error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    const currentAnnouncement = id
      ? await prisma.flyerAnnouncement.findUnique({ where: { id } })
      : await prisma.flyerAnnouncement.findFirst({
          where: { isActive: true },
          orderBy: { updatedAt: "desc" },
        });

    const announcement = currentAnnouncement
      ? await prisma.flyerAnnouncement.update({
          where: { id: currentAnnouncement.id },
          data: { isActive: false },
        })
      : null;

    revalidatePath("/flyers");

    return jsonNoStore({ announcement });
  } catch (error) {
    console.error("[DELETE /api/admin/flyer-announcement]", error);
    return jsonNoStore({ error: "홍보문구 숨김 처리에 실패했습니다." }, { status: 500 });
  }
}

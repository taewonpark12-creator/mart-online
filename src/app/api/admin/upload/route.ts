import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { isAdminAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";

const FLYER_UPLOAD_REPO = process.env.FLYER_UPLOAD_REPO ?? "taewonpark12-creator/mart-online";
const FLYER_UPLOAD_BRANCH = process.env.FLYER_UPLOAD_BRANCH ?? "main";
const FLYER_UPLOAD_DIR = "public/flyers";
const MAX_FLYER_IMAGE_BYTES = 20 * 1024 * 1024;
const FLYER_IMAGE_MAX_LONG_EDGE = 2800;
const FLYER_IMAGE_QUALITY = 85;

const ALLOWED_FLYER_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".webp",
  "image/png": ".webp",
  "image/webp": ".webp",
};

function createFlyerFilename(file: File, ext: string) {
  const originalName = file.name.replace(/\.[^.]+$/, "");
  const slug =
    originalName
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "flyer";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const uniqueId = randomUUID().slice(0, 8);

  return `${date}-${slug}-${uniqueId}${ext}`;
}

async function uploadFlyerToGitHub(filePath: string, content: Buffer) {
  const token = process.env.GITHUB_TOKEN ?? process.env.FLYER_UPLOAD_GITHUB_TOKEN;

  if (!token) {
    throw new Error("GITHUB_TOKEN is required for flyer uploads.");
  }

  const [owner, repo] = FLYER_UPLOAD_REPO.split("/");

  if (!owner || !repo) {
    throw new Error("FLYER_UPLOAD_REPO must be in owner/repo format.");
  }

  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`, {
    method: "PUT",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      branch: FLYER_UPLOAD_BRANCH,
      content: content.toString("base64"),
      message: `Add flyer image ${filePath.split("/").at(-1)}`,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`GitHub upload failed (${response.status}): ${details}`);
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Please select an image file." }, { status: 400 });
    }

    if (file.size > MAX_FLYER_IMAGE_BYTES) {
      return NextResponse.json({ error: "전단 이미지는 20MB 이하만 업로드할 수 있습니다." }, { status: 400 });
    }

    const ext = ALLOWED_FLYER_IMAGE_TYPES[file.type];
    if (!ext) {
      return NextResponse.json({ error: "JPG, PNG, WebP 전단 이미지만 업로드할 수 있습니다." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = createFlyerFilename(file, ext);
    const filePath = `${FLYER_UPLOAD_DIR}/${filename}`;
    let optimizedBuffer: Buffer;

    try {
      optimizedBuffer = await sharp(buffer, { failOn: "warning" })
        .rotate()
        .resize({
          width: FLYER_IMAGE_MAX_LONG_EDGE,
          height: FLYER_IMAGE_MAX_LONG_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: FLYER_IMAGE_QUALITY })
        .toBuffer();
    } catch {
      return NextResponse.json({ error: "이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
    }

    await uploadFlyerToGitHub(filePath, optimizedBuffer);

    return NextResponse.json({ url: `/flyers/${filename}` });
  } catch (error) {
    console.error("[POST /api/admin/upload]", error);
    return NextResponse.json({ error: "Failed to upload flyer image." }, { status: 500 });
  }
}

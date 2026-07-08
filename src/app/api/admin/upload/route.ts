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

class FlyerUploadError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly publicMessage: string,
    public readonly status = 500,
  ) {
    super(message);
    this.name = "FlyerUploadError";
  }
}

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

async function uploadFlyerToGitHub(filePath: string, content: Buffer, requestId: string) {
  const token = process.env.GITHUB_TOKEN ?? process.env.FLYER_UPLOAD_GITHUB_TOKEN;

  if (!token) {
    throw new FlyerUploadError(
      "GITHUB_TOKEN or FLYER_UPLOAD_GITHUB_TOKEN is required for flyer uploads.",
      "MISSING_GITHUB_TOKEN",
      "전단 이미지 저장을 위한 GitHub 토큰이 설정되어 있지 않습니다.",
    );
  }

  const [owner, repo] = FLYER_UPLOAD_REPO.split("/");

  if (!owner || !repo) {
    throw new FlyerUploadError(
      "FLYER_UPLOAD_REPO must be in owner/repo format.",
      "INVALID_GITHUB_REPO",
      "전단 이미지 저장소 설정이 올바르지 않습니다.",
    );
  }

  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const targetUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;
  console.info("[POST /api/admin/upload] GitHub flyer upload start", {
    requestId,
    repo: `${owner}/${repo}`,
    branch: FLYER_UPLOAD_BRANCH,
    filePath,
    optimizedBytes: content.byteLength,
  });

  const response = await fetch(targetUrl, {
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
    console.error("[POST /api/admin/upload] GitHub flyer upload failed", {
      requestId,
      status: response.status,
      statusText: response.statusText,
      repo: `${owner}/${repo}`,
      branch: FLYER_UPLOAD_BRANCH,
      filePath,
      targetUrl,
      details: details.slice(0, 1000),
    });
    throw new FlyerUploadError(
      `GitHub upload failed (${response.status}): ${details}`,
      "GITHUB_UPLOAD_FAILED",
      `GitHub 저장에 실패했습니다. 상태 코드: ${response.status}`,
    );
  }
}

function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error instanceof FlyerUploadError ? error.code : undefined,
    };
  }

  return {
    name: typeof error,
    message: String(error),
  };
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();

  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const formKeys = [...formData.keys()];

    if (!(file instanceof File)) {
      console.error("[POST /api/admin/upload] Missing flyer file field", {
        requestId,
        formKeys,
        expectedField: "file",
      });
      return NextResponse.json({ error: "Please select an image file." }, { status: 400 });
    }

    console.info("[POST /api/admin/upload] Flyer upload received", {
      requestId,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      maxBytes: MAX_FLYER_IMAGE_BYTES,
      formKeys,
      allowedTypes: Object.keys(ALLOWED_FLYER_IMAGE_TYPES),
      hasGithubToken: Boolean(process.env.GITHUB_TOKEN || process.env.FLYER_UPLOAD_GITHUB_TOKEN),
      uploadRepo: FLYER_UPLOAD_REPO,
      uploadBranch: FLYER_UPLOAD_BRANCH,
      uploadDir: FLYER_UPLOAD_DIR,
      sharpAvailable: typeof sharp === "function",
    });

    if (file.size > MAX_FLYER_IMAGE_BYTES) {
      console.error("[POST /api/admin/upload] Flyer file too large", {
        requestId,
        fileName: file.name,
        fileSize: file.size,
        maxBytes: MAX_FLYER_IMAGE_BYTES,
      });
      return NextResponse.json({ error: "전단 이미지는 20MB 이하만 업로드할 수 있습니다." }, { status: 400 });
    }

    const ext = ALLOWED_FLYER_IMAGE_TYPES[file.type];
    if (!ext) {
      console.error("[POST /api/admin/upload] Unsupported flyer image type", {
        requestId,
        fileName: file.name,
        fileType: file.type,
        allowedTypes: Object.keys(ALLOWED_FLYER_IMAGE_TYPES),
      });
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
      console.info("[POST /api/admin/upload] Flyer image optimized", {
        requestId,
        fileName: file.name,
        originalBytes: buffer.byteLength,
        optimizedBytes: optimizedBuffer.byteLength,
        maxLongEdge: FLYER_IMAGE_MAX_LONG_EDGE,
        quality: FLYER_IMAGE_QUALITY,
        outputType: "image/webp",
      });
    } catch (error) {
      console.error("[POST /api/admin/upload] Flyer image optimization failed", {
        requestId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        error: getErrorDetails(error),
      });
      return NextResponse.json({ error: "이미지 파일만 업로드할 수 있습니다." }, { status: 400 });
    }

    await uploadFlyerToGitHub(filePath, optimizedBuffer, requestId);

    console.info("[POST /api/admin/upload] Flyer upload succeeded", {
      requestId,
      filePath,
      url: `/flyers/${filename}`,
      optimizedBytes: optimizedBuffer.byteLength,
    });

    return NextResponse.json({ url: `/flyers/${filename}` });
  } catch (error) {
    const status = error instanceof FlyerUploadError ? error.status : 500;
    const message =
      error instanceof FlyerUploadError
        ? error.publicMessage
        : "전단 이미지 업로드 중 서버 오류가 발생했습니다. Vercel 로그를 확인해주세요.";

    console.error("[POST /api/admin/upload] Flyer upload failed", {
      requestId,
      error: getErrorDetails(error),
      config: {
        maxBytes: MAX_FLYER_IMAGE_BYTES,
        maxLongEdge: FLYER_IMAGE_MAX_LONG_EDGE,
        quality: FLYER_IMAGE_QUALITY,
        uploadRepo: FLYER_UPLOAD_REPO,
        uploadBranch: FLYER_UPLOAD_BRANCH,
        uploadDir: FLYER_UPLOAD_DIR,
        hasGithubToken: Boolean(process.env.GITHUB_TOKEN || process.env.FLYER_UPLOAD_GITHUB_TOKEN),
      },
    });

    return NextResponse.json(
      {
        error: message,
        message,
        code: error instanceof FlyerUploadError ? error.code : "FLYER_UPLOAD_FAILED",
        requestId,
      },
      { status },
    );
  }
}

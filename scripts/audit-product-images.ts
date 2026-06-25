import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";

type ProductImage = {
  id: string;
  name: string;
  barcode: string | null;
  imageUrl: string | null;
};

type AuditResult = {
  productId: string;
  name: string;
  barcode: string;
  imageUrl: string;
  source: "remote" | "local" | "invalid" | "empty";
  status: "ok" | "failed";
  httpStatus: string;
  contentType: string;
  bytes: number | null;
  sizeKB: number | null;
  width: number | null;
  height: number | null;
  exceeds300KB: boolean;
  exceeds500KB: boolean;
  exceeds1MB: boolean;
  exceeds1200px: boolean;
  error: string;
};

const DEFAULT_OUTPUT = "product-image-audit.csv";
const DEFAULT_CONCURRENCY = 10;
const DEFAULT_TIMEOUT_MS = 15000;
const DIMENSION_RANGE_BYTES = 256 * 1024;

const prisma = new PrismaClient();

function getArg(name: string, fallback?: string) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function getNumberArg(name: string, fallback: number) {
  const value = Number(getArg(name));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: AuditResult[]) {
  const headers = [
    "productId",
    "name",
    "barcode",
    "imageUrl",
    "source",
    "status",
    "httpStatus",
    "contentType",
    "bytes",
    "sizeKB",
    "width",
    "height",
    "exceeds300KB",
    "exceeds500KB",
    "exceeds1MB",
    "exceeds1200px",
    "error",
  ];

  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header as keyof AuditResult])).join(",")),
  ].join("\n");
}

function baseResult(product: ProductImage): AuditResult {
  return {
    productId: product.id,
    name: product.name,
    barcode: product.barcode ?? "",
    imageUrl: product.imageUrl?.trim() ?? "",
    source: "empty",
    status: "failed",
    httpStatus: "",
    contentType: "",
    bytes: null,
    sizeKB: null,
    width: null,
    height: null,
    exceeds300KB: false,
    exceeds500KB: false,
    exceeds1MB: false,
    exceeds1200px: false,
    error: "",
  };
}

function finalize(result: AuditResult) {
  if (typeof result.bytes === "number") {
    result.sizeKB = Math.round((result.bytes / 1024) * 10) / 10;
    result.exceeds300KB = result.bytes > 300 * 1024;
    result.exceeds500KB = result.bytes > 500 * 1024;
    result.exceeds1MB = result.bytes > 1024 * 1024;
  }

  result.exceeds1200px =
    (typeof result.width === "number" && result.width > 1200) ||
    (typeof result.height === "number" && result.height > 1200);

  return result;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      redirect: "follow",
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function parseContentLength(response: Response) {
  const contentLength = response.headers.get("content-length");
  const parsed = contentLength ? Number(contentLength) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseContentRangeTotal(response: Response) {
  const contentRange = response.headers.get("content-range");
  const match = contentRange?.match(/\/(\d+)$/);
  const parsed = match ? Number(match[1]) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseImageDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if (buffer.length >= 10 && buffer.toString("ascii", 0, 3) === "GIF") {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }

  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    return parseWebpDimensions(buffer);
  }

  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return parseJpegDimensions(buffer);
  }

  return null;
}

function parseJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  const sofMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;

    if (offset + 2 > buffer.length) return null;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return null;

    if (sofMarkers.has(marker) && length >= 7) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }

    offset += length;
  }

  return null;
}

function parseWebpDimensions(buffer: Buffer): { width: number; height: number } | null {
  const chunkType = buffer.toString("ascii", 12, 16);

  if (chunkType === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  if (chunkType === "VP8 " && buffer.length >= 30) {
    const frameStart = buffer.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20);
    if (frameStart !== -1 && frameStart + 7 < buffer.length) {
      return {
        width: buffer.readUInt16LE(frameStart + 3) & 0x3fff,
        height: buffer.readUInt16LE(frameStart + 5) & 0x3fff,
      };
    }
  }

  if (chunkType === "VP8L" && buffer.length >= 25) {
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];

    return {
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }

  return null;
}

async function inspectLocalImage(product: ProductImage, result: AuditResult) {
  result.source = "local";
  const relativePath = result.imageUrl.replace(/^\/+/, "");
  const filePath = path.join(process.cwd(), "public", relativePath);
  const stat = await fs.stat(filePath);
  const buffer = await fs.readFile(filePath);
  const dimensions = parseImageDimensions(buffer);

  result.status = "ok";
  result.bytes = stat.size;
  result.contentType = contentTypeFromUrl(result.imageUrl);
  result.width = dimensions?.width ?? null;
  result.height = dimensions?.height ?? null;

  return finalize(result);
}

async function inspectRemoteImage(product: ProductImage, result: AuditResult, timeoutMs: number) {
  result.source = "remote";
  let contentLength: number | null = null;

  const head = await fetchWithTimeout(result.imageUrl, { method: "HEAD" }, timeoutMs);
  result.httpStatus = String(head.status);
  result.contentType = head.headers.get("content-type") ?? "";

  if (!head.ok) {
    throw new Error(`HEAD ${head.status}`);
  }

  contentLength = parseContentLength(head);

  const range = await fetchWithTimeout(
    result.imageUrl,
    {
      method: "GET",
      headers: { Range: `bytes=0-${DIMENSION_RANGE_BYTES - 1}` },
    },
    timeoutMs,
  );

  result.httpStatus = result.httpStatus || String(range.status);
  result.contentType = result.contentType || range.headers.get("content-type") || "";

  if (!range.ok && range.status !== 206) {
    throw new Error(`GET ${range.status}`);
  }

  contentLength = contentLength ?? parseContentRangeTotal(range) ?? parseContentLength(range);
  const sampleBuffer = Buffer.from(await range.arrayBuffer());
  const dimensions = parseImageDimensions(sampleBuffer);

  if (!contentLength || range.status === 200) {
    contentLength = sampleBuffer.length;
  }

  result.status = "ok";
  result.bytes = contentLength;
  result.width = dimensions?.width ?? null;
  result.height = dimensions?.height ?? null;

  return finalize(result);
}

function contentTypeFromUrl(url: string) {
  const ext = path.extname(url.split("?")[0]).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "";
}

async function inspectImage(product: ProductImage, timeoutMs: number): Promise<AuditResult> {
  const result = baseResult(product);

  try {
    if (!result.imageUrl) {
      result.error = "EMPTY_IMAGE_URL";
      return finalize(result);
    }

    if (result.imageUrl.startsWith("/")) {
      return await inspectLocalImage(product, result);
    }

    const url = new URL(result.imageUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      result.source = "invalid";
      result.error = "UNSUPPORTED_URL_PROTOCOL";
      return finalize(result);
    }

    return await inspectRemoteImage(product, result, timeoutMs);
  } catch (error) {
    result.status = "failed";
    result.error = error instanceof Error ? error.message : String(error);
    return finalize(result);
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index], index);
      }
    }),
  );

  return results;
}

function printSummary(results: AuditResult[]) {
  const successfulSizes = results
    .map((result) => result.bytes)
    .filter((bytes): bytes is number => typeof bytes === "number");
  const averageBytes =
    successfulSizes.length > 0
      ? Math.round(successfulSizes.reduce((sum, bytes) => sum + bytes, 0) / successfulSizes.length)
      : 0;

  console.log("상품 이미지 점검 결과");
  console.log(`- 전체 이미지 개수: ${results.length}`);
  console.log(`- 평균 파일 용량: ${Math.round((averageBytes / 1024) * 10) / 10} KB`);
  console.log(`- 300KB 초과 개수: ${results.filter((result) => result.exceeds300KB).length}`);
  console.log(`- 500KB 초과 개수: ${results.filter((result) => result.exceeds500KB).length}`);
  console.log(`- 1MB 초과 개수: ${results.filter((result) => result.exceeds1MB).length}`);
  console.log(`- 1200px 초과 이미지 개수: ${results.filter((result) => result.exceeds1200px).length}`);
  console.log(`- 실패한 URL 개수: ${results.filter((result) => result.status === "failed").length}`);
}

async function main() {
  const output = getArg("output", DEFAULT_OUTPUT)!;
  const concurrency = getNumberArg("concurrency", DEFAULT_CONCURRENCY);
  const timeoutMs = getNumberArg("timeoutMs", DEFAULT_TIMEOUT_MS);
  const limit = getNumberArg("limit", 0);

  const products = await prisma.product.findMany({
    where: {
      imageUrl: {
        not: null,
      },
    },
    select: {
      id: true,
      name: true,
      barcode: true,
      imageUrl: true,
    },
    orderBy: {
      name: "asc",
    },
    ...(limit > 0 ? { take: limit } : {}),
  });

  const uniqueProducts = products.filter((product) => product.imageUrl?.trim());
  console.log(`이미지 URL ${uniqueProducts.length}개 점검 시작 (concurrency=${concurrency}, timeoutMs=${timeoutMs})`);

  const results = await mapWithConcurrency(uniqueProducts, concurrency, async (product, index) => {
    if ((index + 1) % 100 === 0 || index === uniqueProducts.length - 1) {
      console.log(`진행: ${index + 1}/${uniqueProducts.length}`);
    }

    return inspectImage(product, timeoutMs);
  });

  await fs.writeFile(output, `${toCsv(results)}\n`, "utf8");
  printSummary(results);
  console.log(`CSV 저장: ${path.resolve(output)}`);
}

main()
  .catch((error) => {
    console.error("[audit-product-images] 실패:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

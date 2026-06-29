import path from "path";

export const PRODUCT_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "products");
export const PRODUCT_UPLOAD_URL_PREFIX = "/uploads/products";

export const MAX_PRODUCT_IMAGE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_PRODUCT_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const ALLOWED_PRODUCT_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

export function isProductImagePath(url: string | null | undefined) {
  return Boolean(url?.startsWith(PRODUCT_UPLOAD_URL_PREFIX));
}

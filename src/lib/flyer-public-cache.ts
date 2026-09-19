import { invalidateByTag } from "@vercel/functions";

export const FLYERS_PUBLIC_LIST_TAG = "flyers-public-list";
export const FLYERS_PUBLIC_ANNOUNCEMENT_TAG = "flyers-public-announcement";

async function invalidateFlyerPublicCache(tag: string, cacheName: string) {
  try {
    await invalidateByTag(tag);
    return true;
  } catch (error) {
    console.error(`[flyer-public-cache] Failed to invalidate ${cacheName}`, {
      tag,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { type: typeof error },
    });
    return false;
  }
}

export function invalidateFlyersPublicListCache() {
  return invalidateFlyerPublicCache(FLYERS_PUBLIC_LIST_TAG, "flyer list cache");
}

export function invalidateFlyersPublicAnnouncementCache() {
  return invalidateFlyerPublicCache(
    FLYERS_PUBLIC_ANNOUNCEMENT_TAG,
    "flyer announcement cache",
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";

interface Props {
  src?: string | null;
  alt: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
}

export function ProductImage({
  src,
  alt,
  fill = false,
  sizes,
  priority = false,
}: Props) {
  const [failed, setFailed] = useState(false);
  const imageSrc = typeof src === "string" ? src.trim() : "";
  const valid =
    imageSrc.startsWith("/") ||
    imageSrc.startsWith("http://") ||
    imageSrc.startsWith("https://");

  const fallback = (
    <div
      className={
        fill
          ? "absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400 text-xs"
          : "flex h-40 w-40 items-center justify-center bg-gray-100 text-gray-400 text-xs"
      }
      aria-label={alt}
      role="img"
    >
      이미지 없음
    </div>
  );

  if (!imageSrc || failed) {
    return fallback;
  }

  if (!valid) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Invalid product image URL:", imageSrc);
    }
    return fallback;
  }

  if (fill) {
    return (
      <Image
        src={imageSrc}
        alt={alt}
        fill
        sizes={sizes ?? "100vw"}
        quality={75}
        loading={priority ? "eager" : "lazy"}
        priority={priority}
        decoding="async"
        onError={() => setFailed(true)}
        style={{ objectFit: "cover" }}
      />
    );
  }

  return (
    <Image
      src={imageSrc}
      alt={alt}
      width={320}
      height={320}
      sizes={sizes ?? "(max-width: 640px) 160px, 240px"}
      quality={75}
      loading={priority ? "eager" : "lazy"}
      priority={priority}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

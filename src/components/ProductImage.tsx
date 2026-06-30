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
  const [failedSrc, setFailedSrc] = useState("");
  const imageSrc = typeof src === "string" ? src.trim() : "";
  const failed = Boolean(imageSrc) && failedSrc === imageSrc;
  const external = imageSrc.startsWith("http://") || imageSrc.startsWith("https://");
  const valid = imageSrc.startsWith("/") || external;

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
      <span className="px-3 text-center font-semibold leading-relaxed">
        상품 이미지
        <br />
        준비중
      </span>
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

  if (external) {
    return (
      <img
        src={imageSrc}
        alt={alt}
        width={fill ? undefined : 320}
        height={fill ? undefined : 320}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        onError={() => setFailedSrc(imageSrc)}
        className={fill ? "absolute inset-0 h-full w-full object-contain p-1" : "h-auto w-full object-contain"}
      />
    );
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
        onError={() => setFailedSrc(imageSrc)}
        style={{ objectFit: "contain", padding: "0.25rem" }}
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
      onError={() => setFailedSrc(imageSrc)}
    />
  );
}

import Image from "next/image"

interface Props {
  src?: string | null
  alt: string
  fill?: boolean
  sizes?: string
  priority?: boolean
}

export function ProductImage({
  src,
  alt,
  fill = false,
  sizes,
  priority = false,
}: Props) {
  // 문자열 아니면 차단
  if (typeof src !== "string") {
    return null
  }

  const imageSrc = src.trim()

  // 빈값 차단
  if (!imageSrc) {
    return null
  }

  // 정상 URL인지 검사
  const valid =
    imageSrc.startsWith("/") ||
    imageSrc.startsWith("http://") ||
    imageSrc.startsWith("https://")

  // 이상한 값 차단
  if (!valid) {
    console.error("잘못된 이미지 URL:", imageSrc)
    return null
  }

  // fill 모드
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
        style={{
          objectFit: "cover",
        }}
      />
    )
  }

  // 일반 모드
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
    />
  )
}

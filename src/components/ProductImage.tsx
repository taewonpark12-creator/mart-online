import Image from "next/image"

interface Props {
  src?: string | null
  alt: string
  fill?: boolean
  sizes?: string
}

export function ProductImage({
  src,
  alt,
  fill = false,
  sizes,
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
        loading="lazy"
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
      width={500}
      height={500}
      loading="lazy"
      decoding="async"
    />
  )
}
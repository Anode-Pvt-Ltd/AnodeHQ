import NextImage from "next/image";
import { cn } from "@/lib/utils";
import { env } from "@/lib/env";
import type { MediaRef } from "@/types/app";

export interface ImgProps {
  media: MediaRef;
  /** REQUIRED — spec §14.2. There is deliberately no default. */
  sizes: string;
  aspect?: string;
  priority?: boolean;
  className?: string;
  wrapperClassName?: string;
  /** Pass "" to mark the image decorative; otherwise media.altText is used. */
  alt?: string;
  fill?: boolean;
}

function srcFor(media: MediaRef): string {
  if (media.localSrc) return media.localSrc;
  if (!env.supabaseUrl) return "/img/og-default.svg";
  return `${env.supabaseUrl}/storage/v1/object/public/${media.path}`;
}

/**
 * The single image component for the whole site. Reserves its box from the
 * stored dimensions, honours the focal point on crops, and skips Next's
 * optimiser for our own generated SVGs.
 */
export function Img({
  media, sizes, aspect, priority, className, wrapperClassName, alt, fill = true,
}: ImgProps) {
  const src = srcFor(media);
  const isSvg = src.endsWith(".svg");
  const decorative = alt === "";
  const ratio = aspect ?? `${media.width} / ${media.height}`;

  return (
    <div
      className={cn("relative overflow-hidden bg-bg-subtle", wrapperClassName)}
      style={{ aspectRatio: ratio }}
    >
      <NextImage
        src={src}
        alt={decorative ? "" : (alt ?? media.altText)}
        {...(decorative ? { role: "presentation" as const } : {})}
        fill={fill}
        sizes={sizes}
        priority={priority}
        unoptimized={isSvg}
        className={cn("object-cover", className)}
        style={{ objectPosition: `${media.focalX * 100}% ${media.focalY * 100}%` }}
      />
    </div>
  );
}

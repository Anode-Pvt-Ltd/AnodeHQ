import type { MediaRef } from "@/types/app";

/**
 * Seed media helper. Every seed image is a generated, on-brand SVG in
 * /public/img — self-contained, no external assets, and it carries the same
 * MediaRef contract as a real Supabase Storage row so components never
 * know the difference. Spec §14.2.
 */
export function img(name: string, alt: string, width = 1200, height = 900): MediaRef {
  return {
    id: `seed-${name}`,
    path: `img/${name}.svg`,
    localSrc: `/img/${name}.svg`,
    altText: alt,
    width,
    height,
    blurhash: null,
    focalX: 0.5,
    focalY: 0.5,
  };
}

export function avatar(n: number, alt: string): MediaRef {
  return img(`avatar-${n}`, alt, 200, 200);
}

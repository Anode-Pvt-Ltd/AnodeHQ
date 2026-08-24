import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The wordmark is a brand asset, never set in a font (spec §3.2).
 * Both variants ship; CSS picks one so it works in either theme and over the
 * dark hero without a JS round trip.
 */
export function Logo({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Anode — home"
      className={cn("inline-flex shrink-0 items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4", className)}
    >
      <span className="relative block h-7 w-[109px] sm:h-8 sm:w-[125px]">
        <Image
          src="/brand/anode-wordmark-teal.png"
          alt="Anode"
          fill
          priority
          sizes="125px"
          className={cn("object-contain object-left", onDark ? "hidden" : "block dark:hidden")}
        />
        <Image
          src="/brand/anode-wordmark-white.png"
          alt="Anode"
          fill
          priority
          sizes="125px"
          className={cn("object-contain object-left", onDark ? "block" : "hidden dark:block")}
        />
      </span>
    </Link>
  );
}

export function LogoMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <Image
      src="/brand/anode-icon-teal.png"
      alt=""
      width={size}
      height={size}
      className={cn("rounded-[22%]", className)}
    />
  );
}

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/primitives/Container";
import { Button } from "@/components/primitives/Button";
import { PcbStage } from "@/components/pcb/PcbStage";
import type { HomepagePayload } from "@/types/app";

/**
 * Homepage hero — the reference layout: eyebrow, three display lines with the
 * last word in brand teal, subcopy, two CTAs and a social-proof row on the
 * left; the interactive board with its annotation chips on the right.
 *
 * Server component. Only <PcbStage> is client, and it renders the poster
 * immediately so the LCP element is a static image either way.
 */
export function Hero({
  settings, heroModel, stats, teamAvatars,
}: Pick<HomepagePayload, "settings" | "heroModel" | "stats" | "teamAvatars">) {
  const { hero } = settings;
  const lines = hero.headlineLines;
  const headStat = stats[0];

  const renderLine = (line: string, i: number) => {
    const accent = hero.accentWord;
    const idx = accent ? line.toLowerCase().lastIndexOf(accent.toLowerCase()) : -1;
    if (idx === -1) return <span key={i} className="block">{line}</span>;
    return (
      <span key={i} className="block">
        {line.slice(0, idx)}
        <span className="text-brand">{line.slice(idx, idx + accent.length)}</span>
        {line.slice(idx + accent.length)}
      </span>
    );
  };

  return (
    <section
      className="relative overflow-hidden bg-bg-subtle pt-[72px]"
      aria-labelledby="hero-heading"
    >
      {/* soft wash behind the board, as in the reference */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_60%_at_72%_38%,color-mix(in_srgb,var(--color-brand)_11%,transparent),transparent_70%)]"
      />

      <Container className="relative">
        <div className="grid items-center gap-10 pb-16 pt-12 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-8 lg:pb-24 lg:pt-20">
          {/* ---------------------------------------------------------- copy */}
          <div className="flex flex-col">
            <p className="text-label mb-5 text-brand">{hero.eyebrow}</p>

            <h1 id="hero-heading" className="text-display-1 max-w-[13ch] text-fg">
              {lines.map(renderLine)}
            </h1>

            <p className="mt-6 max-w-[46ch] text-body-lg text-fg-muted">{hero.subcopy}</p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" icon={ArrowRight}>
                <Link href={hero.ctaPrimary.href}>{hero.ctaPrimary.label}</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" icon={ArrowRight}>
                <Link href={hero.ctaSecondary.href}>{hero.ctaSecondary.label}</Link>
              </Button>
            </div>

            {/* social proof */}
            {headStat && (
              <div className="mt-12 flex items-center gap-4">
                <ul className="flex -space-x-3">
                  {teamAvatars.map((a, i) => (
                    <li key={a.id} className="relative">
                      <Image
                        src={a.localSrc ?? "/img/avatar-1.svg"}
                        alt=""
                        width={40}
                        height={40}
                        unoptimized
                        className="size-10 rounded-full ring-2 ring-bg-subtle"
                        style={{ zIndex: 10 - i }}
                      />
                    </li>
                  ))}
                </ul>
                <p className="text-body-sm leading-snug text-fg-muted">
                  <span className="tabular font-display text-[1.0625rem] font-bold text-fg">
                    {headStat.prefix}{headStat.value}{headStat.suffix}
                  </span>{" "}
                  {headStat.label}
                  <br />
                  <span className="text-fg-subtle">{hero.proofCaption}</span>
                </p>
              </div>
            )}
          </div>

          {/* --------------------------------------------------------- board */}
          <div className="relative">
            <PcbStage model={heroModel} />
          </div>
        </div>
      </Container>
    </section>
  );
}

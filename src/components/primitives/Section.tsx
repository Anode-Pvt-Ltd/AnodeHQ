import { cn } from "@/lib/utils";
import { Container } from "./Container";

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  tone?: "default" | "subtle" | "wash";
  bleed?: boolean;
  as?: "section" | "div" | "aside";
}

const TONES = {
  default: "bg-bg",
  subtle: "bg-bg-subtle",
  wash: "bg-bg-wash",
} as const;

export function Section({ tone = "default", bleed, className, children, as: Tag = "section", ...p }: SectionProps) {
  return (
    <Tag className={cn("section-y", TONES[tone], className)} {...p}>
      {bleed ? children : <Container>{children}</Container>}
    </Tag>
  );
}

import { cn } from "@/lib/utils";

const TONES = {
  brand: "bg-teal-50 text-teal-700 dark:bg-teal-900/50 dark:text-teal-200",
  neutral: "bg-bg-subtle text-fg-muted",
  outline: "border border-border text-fg-muted",
  success: "bg-success/12 text-success",
  warning: "bg-warning/14 text-warning",
  danger: "bg-danger/12 text-danger",
} as const;

export function Badge({
  tone = "neutral", className, children, ...p
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof TONES }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium tracking-wide",
        TONES[tone], className,
      )}
      {...p}
    >
      {children}
    </span>
  );
}

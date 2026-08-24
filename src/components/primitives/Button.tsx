import * as React from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "@/lib/icons";

const button = cva(
  [
    "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-display font-semibold",
    "transition-all duration-[var(--dur-base)] ease-[var(--ease-standard)]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-ring)]",
    "disabled:pointer-events-none disabled:opacity-55",
    // 44px minimum touch target regardless of visual height
    "after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']",
    "[&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-[var(--dur-base)]",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-brand text-on-brand rounded-full shadow-xs hover:bg-brand-hover hover:shadow-sm active:bg-brand-active hover:[&_svg]:translate-x-0.5",
        secondary:
          "rounded-full border border-border-strong text-fg hover:bg-bg-subtle hover:border-fg-subtle hover:[&_svg]:translate-x-0.5",
        ghost:
          "rounded-full text-fg hover:bg-bg-subtle hover:[&_svg]:translate-x-0.5",
        link:
          "text-accent underline underline-offset-4 decoration-1 hover:decoration-2 px-0 hover:[&_svg]:translate-x-0.5",
        onBrand:
          "rounded-full bg-white/12 text-white ring-1 ring-inset ring-white/30 backdrop-blur hover:bg-white/20 hover:[&_svg]:translate-x-0.5",
        onBrandSolid:
          "rounded-full bg-white text-teal-900 hover:bg-teal-50 hover:[&_svg]:translate-x-0.5",
        danger:
          "rounded-full bg-danger text-white hover:brightness-110",
      },
      size: {
        sm: "h-9 px-4 text-[0.8125rem] [&_svg]:size-4",
        md: "h-11 px-[1.375rem] text-[0.9375rem] [&_svg]:size-[1.05rem]",
        lg: "h-[3.25rem] px-7 text-base [&_svg]:size-5",
      },
      fullWidth: { true: "w-full", false: "" },
    },
    compoundVariants: [{ variant: "link", size: "md", className: "h-auto px-0" }],
    defaultVariants: { variant: "primary", size: "md", fullWidth: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  icon?: LucideIcon;
  iconPosition?: "start" | "end";
  loading?: boolean;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, fullWidth, icon: Icon, iconPosition = "end", loading, asChild, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  const glyph = loading ? <Loader2 className="animate-spin" aria-hidden /> : Icon ? <Icon aria-hidden /> : null;

  return (
    <Comp
      ref={ref}
      className={cn(button({ variant, size, fullWidth }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {glyph && iconPosition === "start" ? glyph : null}
      <Slottable>{children}</Slottable>
      {glyph && iconPosition === "end" ? glyph : null}
    </Comp>
  );
});

export { button as buttonVariants };

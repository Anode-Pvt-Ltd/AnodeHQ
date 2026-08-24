import { cn } from "@/lib/utils";

export function Container({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("container-page", className)} {...p}>{children}</div>;
}

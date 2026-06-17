import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "muted"
  | "outline";

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  default:
    "bg-foreground/10 text-foreground border-transparent",
  primary:
    "bg-primary/12 text-primary border-primary/20 dark:text-primary-300",
  success:
    "bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
  warning:
    "bg-amber-500/15 text-amber-700 border-amber-500/25 dark:text-amber-300",
  muted:
    "bg-muted text-muted-foreground border-transparent",
  outline:
    "bg-transparent text-foreground border-border",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/** Small inline status/label pill. */
export function Badge({
  variant = "default",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium leading-5",
        VARIANT_STYLES[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;

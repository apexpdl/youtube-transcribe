import { forwardRef, type ButtonHTMLAttributes } from "react";

import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "outline"
  | "destructive";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 select-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary-600 active:bg-primary-700",
  secondary:
    "bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.10] active:bg-foreground/[0.14] border border-border",
  ghost:
    "bg-transparent text-foreground hover:bg-foreground/[0.06] active:bg-foreground/[0.10]",
  outline:
    "bg-transparent text-foreground border border-border hover:bg-foreground/[0.05] active:bg-foreground/[0.08]",
  destructive:
    "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10 p-0",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render a spinner and disable the button while true. */
  loading?: boolean;
  /** Optional element placed before the children. */
  leftIcon?: React.ReactNode;
  /** Optional element placed after the children. */
  rightIcon?: React.ReactNode;
}

/** Reusable, accessible button with variants and sizes. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      className,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <Spinner size={size === "lg" ? 20 : 16} />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  },
);

export default Button;

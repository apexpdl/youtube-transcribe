import { cn } from "@/lib/utils";

export interface SpinnerProps {
  className?: string;
  /** Diameter in pixels. Defaults to 20. */
  size?: number;
  /** Accessible label; defaults to "Loading". */
  label?: string;
}

/** A simple, theme-aware loading spinner. */
export function Spinner({ className, size = 20, label = "Loading" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn("inline-flex", className)}
    >
      <svg
        className="animate-spin text-current"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-90"
          fill="currentColor"
          d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export default Spinner;

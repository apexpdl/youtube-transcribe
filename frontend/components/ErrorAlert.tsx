"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface ErrorAlertProps {
  /** The error message to display. */
  message: string;
  /** Optional heading; defaults to "Something went wrong". */
  title?: string;
  /** When provided, renders a retry button. */
  onRetry?: () => void;
  className?: string;
}

/** A prominent, accessible error panel with an optional retry action. */
export function ErrorAlert({
  message,
  title = "Something went wrong",
  onRetry,
  className,
}: ErrorAlertProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-red-300/70 bg-red-50 p-5 text-red-900 shadow-card dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-300">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 break-words text-sm text-red-800/90 dark:text-red-200/90">
            {message}
          </p>
        </div>
      </div>

      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leftIcon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}
          className="flex-shrink-0 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900/50"
        >
          Try again
        </Button>
      )}
    </div>
  );
}

export default ErrorAlert;

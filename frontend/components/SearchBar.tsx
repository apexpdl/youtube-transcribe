"use client";

import { Search, X } from "lucide-react";
import { useId } from "react";

import { cn } from "@/lib/utils";

export interface SearchBarProps {
  /** Current search query (controlled). */
  value: string;
  /** Called when the query changes. */
  onChange: (value: string) => void;
  /** Number of matches for the current query. */
  matchCount: number;
  /** Total number of searchable items (segments). */
  totalCount?: number;
  /** Clears the query. */
  onClear: () => void;
  placeholder?: string;
  className?: string;
}

/**
 * Controlled search input for the transcript, showing a live match count and a
 * clear button.
 */
export function SearchBar({
  value,
  onChange,
  matchCount,
  totalCount,
  onClear,
  placeholder = "Search the transcript…",
  className,
}: SearchBarProps) {
  const inputId = useId();
  const hasQuery = value.trim().length > 0;

  return (
    <div className={cn("relative w-full", className)}>
      <label htmlFor={inputId} className="sr-only">
        Search transcript
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-28 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-primary focus:ring-2 focus:ring-primary/30 [&::-webkit-search-cancel-button]:appearance-none"
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
        {hasQuery && (
          <span
            aria-live="polite"
            className="whitespace-nowrap text-xs tabular-nums text-muted-foreground"
          >
            {matchCount === 0
              ? "No matches"
              : `${matchCount}${totalCount ? `/${totalCount}` : ""}`}
          </span>
        )}
        {hasQuery && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

export default SearchBar;

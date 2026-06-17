import { Suspense } from "react";

import { Home } from "@/components/Home";

/** Lightweight fallback shown while the client island hydrates. */
function HomeFallback() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-14 text-center sm:px-6">
      <div className="mx-auto h-12 w-3/4 max-w-xl animate-pulse rounded-lg bg-muted" />
      <div className="mx-auto mt-4 h-6 w-2/3 max-w-md animate-pulse rounded-lg bg-muted" />
      <div className="mx-auto mt-8 h-12 w-full max-w-2xl animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

/**
 * The home page. `Home` uses `useSearchParams` (to support shareable links), so
 * it must live inside a Suspense boundary per the Next.js App Router rules.
 */
export default function Page() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <Home />
    </Suspense>
  );
}

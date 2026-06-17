import { Heart } from "lucide-react";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <p>© {year} TubeTranscript. For personal and educational use.</p>
        <p className="inline-flex items-center gap-1.5">
          Built with
          <Heart className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden="true" />
          using Next.js
          <span aria-hidden="true">·</span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Source
          </a>
        </p>
      </div>
    </footer>
  );
}

export default Footer;

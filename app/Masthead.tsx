import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Masthead({ dateline }: { dateline: string }) {
  return (
    <header className="masthead">
      <div className="masthead-strip wrap">
        <span>Published the morning after every meeting</span>
        <span>Today — {dateline}</span>
      </div>

      <div className="masthead-rule rule-thick" />

      <div className="masthead-main wrap">
        <Link href="/" className="nameplate">
          Fathom Digest
        </Link>
        <div className="masthead-actions">
          <Link href="/login" className="masthead-signin">
            Sign in
          </Link>
          <Button asChild variant="primary" size="primary">
            <Link href="/signup">Get the digest</Link>
          </Button>
        </div>
      </div>

      <div className="masthead-rule rule-thick" />

      <nav className="masthead-nav wrap" aria-label="Marketing">
        <div className="masthead-nav-links">
          <a href="#dispatches">Features</a>
          <span className="sep" aria-hidden>
            ·
          </span>
          <a href="#process">How it works</a>
          <span className="sep" aria-hidden>
            ·
          </span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer noopener"
          >
            Source ↗
          </a>
        </div>
        <span className="masthead-tagline">
          The daily round-up your team actually reads
        </span>
      </nav>

      <div className="masthead-rule rule-thin" />
    </header>
  );
}

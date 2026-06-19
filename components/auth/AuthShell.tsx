import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  eyebrow,
  headline,
  tagline,
  children,
}: {
  eyebrow: string;
  headline: ReactNode;
  tagline: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <Link href="/" className="auth-brand">
          <span className="mark" aria-hidden />
          Fathom Digest
        </Link>

        <div className="auth-aside-copy">
          <span className="auth-eyebrow">{eyebrow}</span>
          <h1 className="auth-headline">{headline}</h1>
          <p className="auth-tagline">{tagline}</p>
        </div>

        <div className="auth-mock" aria-hidden>
          <div className="auth-mock-meta">
            <span className="dot" />
            Product sync · Thu 2:00p · 38 min
          </div>
          <h3>Digest ready to send</h3>
          <ul>
            <li>Ship the new onboarding flow by Friday</li>
            <li>Maya to follow up with design on copy</li>
            <li>Demo recording for the board on Monday</li>
          </ul>
        </div>

        <p className="auth-aside-foot">
          POWERED BY FATHOM · BUILT FOR TEAMS WHO&apos;D RATHER READ THAN
          REWATCH
        </p>
      </aside>

      <main className="auth-main">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}

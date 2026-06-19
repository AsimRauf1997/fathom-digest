import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Masthead from "./Masthead";

const DISPATCHES = [
  {
    title: "One inbox, every recording",
    body: "All of a day's Fathom calls land in a single review queue — no hunting through a recordings library.",
  },
  {
    title: "Editable AI draft",
    body: "Summaries and action items arrive pre-written. Tweak the wording or the intro note before it ships.",
  },
  {
    title: "Action items, attributed",
    body: "Every follow-up keeps its owner, so the digest reads like minutes, not a transcript dump.",
  },
  {
    title: "Send to the whole team",
    body: "One compose panel, a list of recipients, a live email preview — then it's in everyone's inbox.",
  },
];

const PROCESS = [
  {
    numeral: "I",
    title: "Connect Fathom",
    body: "Drop in your team's Fathom API key once. Every recording your team makes is ready to digest.",
  },
  {
    numeral: "II",
    title: "Pick a date",
    body: "Fathom Digest pulls every recording from that day, summary and action items included.",
  },
  {
    numeral: "III",
    title: "Review & send",
    body: "Edit the draft, add a note, preview the email, and send it to your whole team in one click.",
  },
];

export default function LandingPage() {
  const today = new Date();
  const dateline = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="lp">
      <Masthead dateline={dateline} />

      <section className="front-page wrap">
        <div className="lead-story">
          <span className="stamp" aria-hidden>
            First
            <br />
            edition
          </span>

          <span className="kicker">Lead story</span>
          <h1 className="headline">
            Your team stopped rewatching meetings.
            <br />
            <em>Here&apos;s what they read instead.</em>
          </h1>
          <p className="lede">
            <span className="drop-cap">F</span>athom Digest pulls every
            recording your team makes, drafts the summary and the action
            items, and gets a clean edition into everyone&apos;s inbox before
            the next meeting starts. Nothing to rewatch. Nothing to dig for.
          </p>
          <div className="byline">
            FILED BY THE FATHOM DIGEST TEAM · 4 MIN READ
          </div>

          <div className="lead-cta">
            <Button asChild variant="primary" size="primary">
              <Link href="/signup">
                Get started — it&apos;s free <ArrowRight size={15} />
              </Link>
            </Button>
            <Button asChild variant="outline" size="primary">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <span className="cta-note">No credit card · live in 5 minutes</span>
        </div>

        <aside className="sidebar-stats">
          <div className="stats-head">By the numbers</div>

          <div className="stat">
            <span className="stat-num">
              1<span className="unit">inbox</span>
            </span>
            <span className="stat-label">
              for every recording your team makes that day
            </span>
          </div>
          <div className="stat">
            <span className="stat-num">
              0<span className="unit">rewatches</span>
            </span>
            <span className="stat-label">
              needed to know what happened and who owns what
            </span>
          </div>
          <div className="stat">
            <span className="stat-num">
              5<span className="unit">minutes</span>
            </span>
            <span className="stat-label">
              from connecting Fathom to sending your first edition
            </span>
          </div>

          <div className="weather-box">
            <span>Today&apos;s forecast</span>
            <strong>0% chance of rewatching</strong>
          </div>
        </aside>
      </section>

      <section className="dispatches wrap" id="dispatches">
        <div className="label-rule">Inside this edition</div>
        <div className="dispatch-grid">
          {DISPATCHES.map((d, i) => (
            <article className="dispatch" key={d.title}>
              <span className="dispatch-num">{`No. 0${i + 1}`}</span>
              <h3>{d.title}</h3>
              <p>{d.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="dark-band manifesto">
        <span className="manifesto-mark" aria-hidden>
          &ldquo;
        </span>
        <blockquote>
          Most meeting tools optimize for recording everything. We optimize
          for reading none of it twice.
        </blockquote>
        <cite>The Fathom Digest manifesto</cite>
      </section>

      <section className="process wrap" id="process">
        <div className="label-rule">The process</div>
        <div className="process-grid">
          {PROCESS.map((step) => (
            <div className="process-step" key={step.numeral}>
              <span className="process-num">{step.numeral}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="dark-band subscribe">
        <div className="subscribe-inner">
          <span className="kicker kicker-on-dark">Ready when you are</span>
          <h2>
            Get tomorrow&apos;s edition before anyone asks what they missed.
          </h2>
          <p>
            Connect Fathom, pick a date, and send your first digest in under
            five minutes.
          </p>
          <Button asChild variant="primary" size="primary">
            <Link href="/signup">
              Get started — it&apos;s free <ArrowRight size={15} />
            </Link>
          </Button>
          <span className="cta-note cta-note-on-dark">
            No credit card required
          </span>
        </div>
      </section>

      <footer className="colophon wrap">
        <span>Fathom Digest · Published daily, when you have meetings</span>
        <div className="colophon-links">
          <a href="https://github.com" target="_blank" rel="noreferrer noopener">
            GitHub
          </a>
          <a href="https://fathom.video" target="_blank" rel="noreferrer noopener">
            Powered by Fathom
          </a>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  );
}

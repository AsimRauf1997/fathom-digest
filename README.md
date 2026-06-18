# Meeting Notes Digest

A small local web app that pulls your **Fathom** meeting notes for a given day
(or a single meeting by ID), shows the AI summary + action items as **plain text
(no links, no transcript)**, and **emails a templated digest** to your teammates
with one click.

- **In:** Fathom public REST API
- **Out:** Email via **Resend**, using a **React Email** template
- **Stack:** Next.js (App Router) + TypeScript, runs locally

## 1. Setup

```bash
cd fathom-digest
npm install
cp .env.example .env.local
```

Then fill in `.env.local`:

### Fathom

- `FATHOM_API_KEY` — create in Fathom (Settings → API keys). Requires a Fathom
  plan that includes API access. Keys are per-user; limit is 60 calls/min.

### Email (Resend)

1. Create a Resend account at resend.com and an API key (**API Keys → Create**).
   Put it in `RESEND_API_KEY`.
2. **Verify a sending domain** (**Domains → Add Domain**) and set `MAIL_FROM` to
   an address on it, e.g. `notes@yourdomain.com` (optionally a display name in
   `MAIL_FROM_NAME`).
   - **No domain yet?** For quick testing set `MAIL_FROM=onboarding@resend.dev`
     (Resend's shared test sender — it only delivers to your own account email).
     A verified domain is required to email arbitrary recipients in production.

### Recipients

- `RECIPIENTS` — comma-separated emails that prefill the recipient list (still
  editable in the UI). **While testing, set this to your own email first.**

## 2. Run

```bash
npm run dev      # the app           -> http://localhost:3000
npm run email    # email template preview server -> http://localhost:3030
```

`npm run email` is the **React Email preview server** — use it while iterating on
the template in `emails/MeetingDigest.tsx`; it hot-reloads and renders the sample
data from the template's `PreviewProps`.

## 3. Use

1. Pick a **Source**: **By date** (loads that day's meetings) or **By meeting ID**
   (loads a single meeting). The app loads today's meetings on first open.
2. Review each meeting in the **Briefing** column: title, time, summary, actions.
3. In **Dispatch**: edit the subject, add an optional **intro note**, and watch the
   **email preview** re-render live. The body is generated from the template — to
   change its design, edit `emails/MeetingDigest.tsx`.
4. Confirm recipients, then click **Send dispatch**.

## How it fits together

| File | Role |
| --- | --- |
| `lib/fathom.ts` | Fathom API client: `listMeetings()` + `getMeetingById()` |
| `lib/markdown.ts` | Link-free Markdown → text/HTML helpers |
| `emails/MeetingDigest.tsx` | The **React Email template** (the email's design) |
| `lib/render-email.tsx` | Renders the template to HTML + plain-text |
| `lib/mailer.ts` | Sends email via **Resend** (the swappable provider bit) |
| `app/api/meetings/route.ts` | `GET /api/meetings?date=YYYY-MM-DD` or `?id=<meetingId>` |
| `app/api/preview/route.ts` | `POST /api/preview` → rendered template HTML (live preview) |
| `app/api/send/route.ts` | `POST /api/send` → re-renders the template and sends |
| `app/DigestApp.tsx` | The single-screen UI |

## Notes

- All secrets stay server-side; nothing sensitive is exposed to the browser.
- **Template-driven sending:** the email body is always (re)rendered from the
  template on the server at send time, so the recipient gets exactly what the
  template produces — the client can't ship broken/edited HTML. Customize via the
  subject and intro note in the UI, or edit the template itself.
- **Swapping providers:** only `lib/mailer.ts` knows about Resend.
- The day window is computed in UTC. If meetings near midnight get misfiled, make
  the window timezone-aware in `app/api/meetings/route.ts`.
- To deploy later (e.g. Vercel), set the same env vars in the host's dashboard.

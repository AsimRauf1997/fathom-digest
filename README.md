# Meeting Notes Digest

A small local web app that pulls your **Fathom** meeting notes for a given day
(or a single meeting by ID), shows the AI summary + action items as **plain text
(no links, no transcript)**, and **emails a templated digest** to your teammates
with one click.

- **In:** Fathom public REST API
- **Out:** Email via **SendGrid**, using a **React Email** template
- **Stack:** Next.js (App Router) + TypeScript, runs locally

## 1. Setup

```bash
cd fathom-digest
npm install
cp .env.example .env.local
```

Then fill in `.env.local`:

### Supabase (Auth + Database)

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from your
  Supabase project's **Settings → API**.
- `SUPABASE_SERVICE_ROLE_KEY` — same page, **server-only**, never exposed to
  the browser. Used for team invites and reading/writing the encrypted Fathom
  key.
- `SUPABASE_DB_ENCRYPTION_KEY` — passphrase used to encrypt each team's Fathom
  API key at rest via Postgres `pgcrypto`. Generate with
  `openssl rand -base64 32`. Rotating it requires re-encrypting existing keys
  first (see `supabase/migrations/0001_init.sql`).
- `NEXT_PUBLIC_SITE_URL` — base URL used for invite/auth redirect links (e.g.
  `http://localhost:3000` locally).
- Apply `supabase/migrations/0001_init.sql` once via the Supabase Dashboard's
  SQL Editor — it creates the `teams`/`team_members` tables, RLS policies, and
  the encrypt/decrypt helper functions.
- Enable Google as an OAuth provider under **Authentication → Providers** if
  you want "Continue with Google" to work.

### Fathom

There's no global Fathom API key anymore — each **team** has its own key,
entered by an admin during onboarding or from **Settings**. It's encrypted at
rest and used to fetch meetings for everyone on that team.

### Email (SendGrid)

1. Create a SendGrid account at sendgrid.com and an API key (**Settings → API Keys → Create API Key**).
   Put it in `SENDGRID_API_KEY`.
2. **Verify a sending domain** (**Settings → Sender Authentication**) and set `MAIL_FROM` to
   an address on it, e.g. `notes@yourdomain.com` (optionally a display name in
   `MAIL_FROM_NAME`).
   - A verified sender domain is required to send emails in production.

## 2. Run

```bash
npm run dev      # the app           -> http://localhost:3000
npm run email    # email template preview server -> http://localhost:3030
```

`npm run email` is the **React Email preview server** — use it while iterating on
the template in `emails/MeetingDigest.tsx`; it hot-reloads and renders the sample
data from the template's `PreviewProps`.

## 3. Use

1. **Sign up** at `/signup` (email/password or Google). The first user on a
   team creates it during onboarding and becomes its **admin** — entering a
   Fathom API key there is optional and can be added later from **Settings**.
2. Admins can invite teammates by email from **Settings**; invited users join
   the same team as **members** automatically once they accept.
3. Pick a **Source**: **By date** (loads that day's meetings) or **By meeting ID**
   (loads a single meeting). The app loads today's meetings on first open.
4. Review each meeting in the **Briefing** column: title, time, summary, actions.
5. In **Dispatch**: edit the subject, add an optional **intro note**, and watch the
   **email preview** re-render live. The body is generated from the template — to
   change its design, edit `emails/MeetingDigest.tsx`.
6. Confirm recipients, then click **Send dispatch**.

## How it fits together

| File | Role |
| --- | --- |
| `lib/fathom.ts` | Fathom API client: `listMeetings()` + `getMeetingById()` |
| `lib/markdown.ts` | Link-free Markdown → text/HTML helpers |
| `emails/MeetingDigest.tsx` | The **React Email template** (the email's design) |
| `lib/render-email.tsx` | Renders the template to HTML + plain-text |
| `lib/mailer.ts` | Sends email via **SendGrid** (the swappable provider bit) |
| `app/api/meetings/route.ts` | `GET /api/meetings?date=YYYY-MM-DD` or `?id=<meetingId>` |
| `app/api/preview/route.ts` | `POST /api/preview` → rendered template HTML (live preview) |
| `app/api/send/route.ts` | `POST /api/send` → re-renders the template and sends |
| `app/DigestApp.tsx` | The single-screen UI |
| `lib/supabase/server.ts` / `client.ts` / `admin.ts` | Supabase Auth/DB clients (server, browser, service-role) |
| `lib/team-context.ts` | Resolves the logged-in user's team + decrypted Fathom key |
| `app/login`, `app/signup`, `app/auth/callback` | Auth pages and OAuth/invite callback |
| `app/onboarding` | Create-a-team flow (admin), with skippable Fathom key entry |
| `app/settings` | Manage the team's Fathom key, invite members, manage roles |
| `supabase/migrations/0001_init.sql` | `teams`/`team_members` schema, RLS policies, key encryption functions |

## Notes

- All secrets stay server-side; nothing sensitive is exposed to the browser.
- **Template-driven sending:** the email body is always (re)rendered from the
  template on the server at send time, so the recipient gets exactly what the
  template produces — the client can't ship broken/edited HTML. Customize via the
  subject and intro note in the UI, or edit the template itself.
- **Swapping providers:** only `lib/mailer.ts` knows about SendGrid.
- The day window is computed in UTC. If meetings near midnight get misfiled, make
  the window timezone-aware in `app/api/meetings/route.ts`.
- To deploy later (e.g. Vercel), set the same env vars in the host's dashboard.

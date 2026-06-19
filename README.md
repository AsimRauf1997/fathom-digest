# Meeting Notes Digest

A full-stack web app for pulling **Fathom** meeting notes, generating AI summaries and action items, and managing team collaboration. Features multi-team support with role-based access control, invite workflows, and per-team Fathom API key management.

**Tech Stack:**
- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript
- **Auth:** Clerk (email/password + Google OAuth)
- **Database:** Neon Postgres + Drizzle ORM
- **Encryption:** Application-level AES-256-GCM (for Fathom API keys)
- **UI:** TailwindCSS + shadcn/ui + Radix UI
- **Data Fetching:** TanStack React Query
- **Integrations:** Fathom API client

## 1. Setup

### Clone & Install

```bash
cd fathom-digest
npm install
cp .env.example .env.local
```

### Configure Environment Variables

Fill in `.env.local`:

#### Database (Neon Postgres + Drizzle)

- `DATABASE_URL` — Pooled connection string from your Neon project
  ([Dashboard](https://console.neon.tech/) → Connection Details → "Pooled connection").

#### Authentication (Clerk)

1. Sign up at [clerk.com](https://clerk.com) and create an application.
2. From your Clerk Dashboard → **API Keys**, get:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — public key for the frontend
   - `CLERK_SECRET_KEY` — server-only secret key
3. Set up Google as a Social Connection (**User & Authentication → Social Connections → Google**).
4. Configure Clerk Webhooks:
   - Dashboard → **Webhooks → Add Endpoint**
   - URL: `https://yourdomain.com/api/webhooks/clerk` (after deploy)
   - Copy the **Signing Secret** to `CLERK_WEBHOOK_SECRET`
5. Set these environment variables:
   - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login`
   - `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup`
   - `NEXT_PUBLIC_SITE_URL` — base URL for invite and callback links (e.g., `http://localhost:3000` locally)

#### Encryption (Application-Level AES-256-GCM)

- `FATHOM_KEY_ENCRYPTION_KEY` — 32-byte base64-encoded key for encrypting each team's Fathom API key at rest.
  Generate with:
  ```bash
  openssl rand -base64 32
  ```
  **Server-only**, never exposed to the browser. Used by `lib/crypto/fathom-key.ts`.

### Initialize Database

Drizzle ORM will automatically create tables on first connection. To manually run migrations:

```bash
npm run db:migrate
```

To manage the schema visually:

```bash
npm run db:studio
```

## 2. Run

```bash
npm run dev      # Development server -> http://localhost:3000
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Lint code
npm run test     # Run tests
```

## 3. Use

1. **Sign up** at `/signup` (email/password or Google). The first user creates a team during onboarding and becomes its **admin**.
2. **Add Fathom API key** during onboarding or later from **Settings** (team admin only). The key is encrypted at rest.
3. **Invite teammates** from **Settings** → they receive invite links and join the team as **members**.
4. **Accept invites** via the `/accept-invite` page.
5. Load meetings **by date** or **by meeting ID**.
6. View meeting summaries and action items.

## Database Schema

| Table | Purpose |
| --- | --- |
| `users` | Clerk user profiles (id, email, name, avatar) |
| `teams` | Team records with encrypted Fathom API keys |
| `team_members` | User-team relationships with roles (admin/member) |
| `invites` | Pending/accepted team invitations |

## File Structure

| File/Directory | Purpose |
| --- | --- |
| `lib/db/schema.ts` | Drizzle ORM schema definitions |
| `lib/db/index.ts` | Database client initialization |
| `lib/crypto/fathom-key.ts` | AES-256-GCM encryption/decryption for Fathom keys |
| `lib/fathom.ts` | Fathom API client |
| `lib/team-context.ts` | Resolves logged-in user's team + decrypted Fathom key |
| `lib/markdown.ts` | Markdown to text/HTML utilities |
| `app/layout.tsx` | Root layout with Clerk provider |
| `app/page.tsx` | Main digest view |
| `app/login` | Email/password sign-in |
| `app/signup` | Email/password registration |
| `app/sso-callback` | OAuth callback handler |
| `app/onboarding` | Team creation flow (first user) |
| `app/settings` | Team settings, invite members, manage Fathom key |
| `app/accept-invite` | Accept team invitations |
| `app/api/webhooks/clerk` | Clerk webhook handler (user lifecycle events) |
| `app/api/meetings` | `GET` meetings by date or ID |

## Key Features

- **Multi-team support:** Each user can belong to multiple teams.
- **Role-based access:** Admins manage team settings and invites; members view/use team data.
- **Encrypted Fathom keys:** Each team's API key is encrypted at rest with AES-256-GCM.
- **Invite workflow:** Admins invite by email; users accept via unique links.
- **Clerk webhooks:** Automatically sync user updates and deletions.

## Notes

- All secrets stay server-side; nothing sensitive is exposed to the browser.
- The Fathom API key is never sent to the client — all Fathom requests happen server-side.
- To deploy (e.g., Vercel): set the same environment variables in your host's dashboard.
- Database migrations are managed by Drizzle Kit (`npm run db:migrate`).

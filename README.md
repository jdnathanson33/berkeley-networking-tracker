# Berkeley Networking Tracker

A private contact tracker for the people you want to stay connected with at Berkeley. Each signed-in user gets their own list — add someone with their company, role, where you met, free-form notes, and a high/medium/low priority, then sort and filter to find them again. The interesting part is not the CRUD; it's that a user's rows are isolated from every other user's by **Row Level Security inside Postgres itself**, not by a `WHERE` clause in application code. The database extracts the caller's identity from a signed JWT and filters rows before any query returns, so even a caller who bypasses this app entirely and hits the public Data API directly can only ever see their own data.

**Live app: <!-- LIVE_URL -->**

---

## Table of contents

- [Screenshots](#screenshots)
- [Features](#features)
- [Technology stack and why](#technology-stack-and-why)
- [Architecture](#architecture)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Database schema](#database-schema)
- [Authentication and RLS ownership](#authentication-and-rls-ownership)
- [Testing](#testing)
- [Deployment](#deployment)
- [Grading evidence](#grading-evidence)
- [Known limitations and what I would improve next](#known-limitations-and-what-i-would-improve-next)

---

## Screenshots

<!-- SCREENSHOTS -->

---

## Features

**Accounts**
- Email + password sign-up, sign-in, and sign-out via Neon Managed Better Auth
- Session held in an `HttpOnly`, signed cookie that client-side JavaScript cannot read
- Signed-out visitors are redirected before any contact UI is rendered

**Contacts**
- Add a contact with name, company, role, where you met, notes, and priority
- Priority is constrained to `high`, `medium`, or `low` in three independent places
- Edit any field in place; delete with a confirmation step
- Sort by name, company, priority, date added, or last updated — ascending or descending
- Filter by priority, and search across name, company, role, and where you met
- Data lives in Neon Postgres, so it survives refresh, new tabs, and new devices

**Interface**
- Sortable table on desktop; card layout on phones, because a five-column table on a 390px screen is unusable
- Distinct, readable states for loading, empty, empty-after-filtering, success, and error
- Light and dark themes driven by one token set
- Keyboard-navigable and screen-reader labelled (`aria-sort` on sortable headers, `role="alert"` on errors, `aria-live` on result counts)
- Respects `prefers-reduced-motion`

**Security**
- Row Level Security on the `contacts` table with four separate policies
- `user_id` defaults to `auth.user_id()` and is `NOT NULL`, so a row cannot be created without a verified owner
- The `UPDATE` policy carries `WITH CHECK`, so a user cannot reassign one of their rows to somebody else
- Every API route re-verifies the session server-side; no route trusts the client
- No secret is ever sent to the browser or committed to Git

---

## Technology stack and why

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 16 (App Router), TypeScript** | Keeps frontend and backend clearly separated in one deployable unit: `app/(pages)` and `components/` are the frontend, `app/api/*` route handlers are the backend. Server Components let the session check happen before any HTML is sent. TypeScript catches shape mismatches between the API and the UI at build time. |
| Styling | **Tailwind CSS v4** with a component library built on **Radix UI** primitives (shadcn/ui conventions) | The design system is one set of CSS custom properties in `app/globals.css`; every component reads from it, so light/dark and spacing stay consistent without per-screen decisions. Radix supplies the accessibility behaviour (focus trapping, `aria-*` wiring, keyboard handling) for dialogs and selects, which is the part that is easy to get wrong by hand. The components are vendored into `components/ui/`, so there is no opaque dependency between the design and the markup. |
| Validation | **Zod** | One schema in `lib/validation.ts` is imported by the API routes *and* exercised by the tests, so the tests verify the rules the server actually enforces rather than a copy of them. |
| Auth + data | **Neon Managed Better Auth**, **Neon Postgres**, **Neon Data API**, `@neondatabase/neon-js` | Required by the assignment, and the combination is what makes the security model work: Better Auth issues a JWT whose `sub` claim the database can verify itself, and the Data API surfaces tables over HTTPS with RLS enforced. Authorization lives in the database rather than in application code. |
| Tests | **Vitest** | Fast, no configuration beyond a path alias, and runs the real route handler with the database mocked. |
| Hosting | **Vercel** | First-class Next.js support, environment variables scoped per environment, and a public HTTPS URL with zero configuration. |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  BROWSER                                     (frontend)     │
│                                                             │
│  app/sign-in, app/sign-up ──── components/auth-form         │
│  app/page.tsx ──────────────── components/contacts-view     │
│                                 ├── contact-list            │
│                                 ├── contact-form-dialog     │
│                                 └── components/ui/*         │
│                                                             │
│  Holds NO secrets. Never talks to Postgres or the Data API  │
│  directly. Only calls same-origin /api/* routes.            │
└───────────────────────────┬─────────────────────────────────┘
                            │  fetch, session cookie attached
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  VERCEL — Next.js route handlers              (backend)     │
│                                                             │
│  /api/auth/[...path]   proxies to Neon Auth, sets the       │
│                        HttpOnly session cookie              │
│                                                             │
│  /api/contacts         GET  list (sort / filter / search)   │
│                        POST create                          │
│  /api/contacts/[id]    PATCH edit                           │
│                        DELETE remove                        │
│                                                             │
│  Each handler, in order:                                    │
│   1. getSessionUser()  → no session? 401, stop.             │
│   2. Zod parse         → invalid? 400 + field message, stop.│
│   3. auth.token()      → fetch THIS user's JWT              │
│   4. call the Data API with that JWT                        │
│                                                             │
│  Reads NEON_AUTH_COOKIE_SECRET. Server-only; no             │
│  NEXT_PUBLIC_ prefix, so it is never bundled for the client.│
└───────────────────────────┬─────────────────────────────────┘
                            │  HTTPS + Authorization: Bearer <user JWT>
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  NEON — Data API (PostgREST) → Postgres        (database)   │
│                                                             │
│  Verifies the JWT signature against Neon Auth's JWKS.       │
│  Assumes the `authenticated` role.                          │
│  auth.user_id() resolves to the token's `sub` claim.        │
│                                                             │
│  RLS rewrites every statement to include                    │
│      AND user_id = auth.user_id()                           │
│  CHECK constraints reject a blank name or a priority        │
│  outside (high, medium, low).                               │
└─────────────────────────────────────────────────────────────┘
```

### Request flow, in words

Take "JD edits a contact's priority to `low`."

1. The browser sends `PATCH /api/contacts/42` with `{"priority":"low"}` and the session cookie.
2. The route handler calls `getSessionUser()`. The cookie is signed with a server-only secret; a forged one fails verification and the request stops at `401`.
3. The payload goes through `contactUpdateSchema`. `"low"` is in the enum, so it passes. `"urgent"` would stop here at `400` with the message *"Priority must be one of: high, medium, low."*
4. The handler calls `auth.token()` to get JD's JWT, then issues `UPDATE contacts SET priority='low' WHERE id=42` through the Data API with that token attached.
5. Postgres verifies the token, resolves `auth.user_id()` to JD's user id, and — because of the `contacts_update_own` policy — actually runs `... WHERE id=42 AND user_id = auth.user_id()`.
6. If row 42 belongs to somebody else, zero rows match. The handler sees an empty result and returns `404`. **No code checked ownership. The database did.**

---

## Local setup

Requires Node.js 20 or newer.

```bash
git clone <!-- REPO_URL -->
cd berkeley-networking-tracker
npm install

cp .env.example .env.local
# Fill in .env.local with values from the Neon Console (see below)

npm run dev
```

Open <http://localhost:3000>. You will land on the sign-in page; create an account to get in.

Before the app will work against a fresh Neon project, apply the schema once:

1. Neon Console → your project → **SQL Editor**
2. Paste the contents of [`db/schema.sql`](db/schema.sql) and run it

Other commands:

```bash
npm test          # run the automated tests once
npm run test:watch # re-run on change
npm run build     # production build
npm run lint      # ESLint
```

---

## Environment variables

Copy `.env.example` to `.env.local` and fill it in. `.env.local` is gitignored; `.env.example` contains placeholders only.

| Variable | Exposed to browser? | What it is |
| --- | --- | --- |
| `NEXT_PUBLIC_NEON_AUTH_URL` | Yes | Neon Auth HTTPS endpoint. Public by design. |
| `NEXT_PUBLIC_NEON_DATA_API_URL` | Yes | Neon Data API HTTPS endpoint. Public by design — every row behind it is protected by RLS. |
| `NEON_AUTH_BASE_URL` | **No** | Same endpoint, read by the server-side auth handler. |
| `NEON_AUTH_COOKIE_SECRET` | **No** | Signs the session cookie. Minimum 32 characters. Generate with `openssl rand -hex 32`. |
| `DATABASE_URL` | **No** | Direct Postgres connection string. Used only to apply `db/schema.sql`; the running application never reads it. |

**Why it is safe to publish the two `NEXT_PUBLIC_` URLs.** They are addresses, not credentials. Anyone can send a request to the Data API URL, but without a valid JWT they are the `anonymous` role, which has been explicitly revoked from `contacts`. With a valid JWT they are `authenticated`, and RLS narrows every statement to their own rows. The URL grants no access on its own.

**What must never be public.** `DATABASE_URL` is a credential — it names a role and its password and would bypass the Data API entirely. `NEON_AUTH_COOKIE_SECRET` would let an attacker forge a session cookie for any user. Neither carries a `NEXT_PUBLIC_` prefix, so Next.js will not inline them into client bundles, and neither is imported by any `"use client"` module.

---

## Database schema

The full, commented, re-runnable script is [`db/schema.sql`](db/schema.sql).

### `public.contacts`

| Column | Type | Constraints | Purpose |
| --- | --- | --- | --- |
| `id` | `bigint` | primary key, `generated by default as identity` | Surrogate key. |
| `user_id` | `text` | **`not null`**, **`default (auth.user_id())`** | The ownership column. Every RLS policy compares against it. `text`, not `uuid`, because Neon Auth's `sub` claim is a string and `auth.user_id()` returns `text`. |
| `name` | `text` | `not null`, `check (length(btrim(name)) > 0)` | Required. The `btrim` means `"   "` is rejected, not just `""`. |
| `company` | `text` | nullable | Where they work. |
| `role` | `text` | nullable | Their title. |
| `where_met` | `text` | nullable | "Haas orientation", "Sutardja Center mixer". |
| `notes` | `text` | nullable | Free-form. What you'd otherwise forget. |
| `priority` | `text` | `not null`, `default 'medium'`, `check (priority in ('high','medium','low'))` | How much follow-up they warrant. |
| `created_at` | `timestamptz` | `not null default now()` | Sortable "Added" column. |
| `updated_at` | `timestamptz` | `not null default now()` | Maintained by a `before update` trigger. |

Plus an index on `user_id`, since every RLS-filtered query includes it.

### Why `user_id` is defined the way it is

`default (auth.user_id())` and `not null` work as a pair:

- The **default** means the application never sends `user_id` on insert. It cannot get it wrong, and cannot be tricked into sending someone else's. The API route deliberately omits the column, and a test asserts that a client-supplied `user_id` is stripped.
- The **not null** means an unauthenticated caller cannot insert. With no valid JWT, `auth.user_id()` returns `NULL`, the `NOT NULL` constraint fires, and the insert fails. There is no such thing as an ownerless row.

---

## Authentication and RLS ownership

### How identity gets from the browser to Postgres

1. The user signs in. The browser posts to `/api/auth/sign-in/email` on this app's own origin.
2. That route proxies to Neon Managed Better Auth using the server-only cookie secret, and sets an `HttpOnly`, `Secure`, signed session cookie. JavaScript in the page cannot read it, so an XSS bug cannot exfiltrate the session.
3. When the backend needs to query data, it exchanges that session for a short-lived **JWT** via `auth.token()`.
4. That JWT travels to the Neon Data API as a `Bearer` token. Neon verifies its signature against Neon Auth's JWKS — it does not take the app's word for who the user is.
5. Inside Postgres, `auth.user_id()` returns the verified `sub` claim.

The app never tells the database who the user is. It hands over a token the database checks for itself.

### The four policies

```sql
alter table public.contacts enable row level security;
alter table public.contacts force  row level security;

create policy contacts_select_own on public.contacts
  for select to authenticated
  using (auth.user_id() = user_id);

create policy contacts_insert_own on public.contacts
  for insert to authenticated
  with check (auth.user_id() = user_id);

create policy contacts_update_own on public.contacts
  for update to authenticated
  using      (auth.user_id() = user_id)
  with check (auth.user_id() = user_id);

create policy contacts_delete_own on public.contacts
  for delete to authenticated
  using (auth.user_id() = user_id);
```

**`USING` versus `WITH CHECK` — the distinction the whole model rests on:**

- `USING` filters **rows that already exist**: which rows may I read, update, or delete?
- `WITH CHECK` validates **rows as they will be after the write**: is the result still mine?

`UPDATE` needs both, and this is the subtle one. `USING` alone would stop you editing someone else's contact, but would happily let you take your *own* contact and set `user_id` to another person's id — handing them a row, or planting one in their list. `WITH CHECK` evaluates the post-update row and rejects it, because after that change `auth.user_id() = user_id` is false. That is exactly the requirement *"update policies prevent a user from changing a row so it belongs to someone else."*

`INSERT` has only `WITH CHECK` because there is no pre-existing row to filter. `SELECT` and `DELETE` have only `USING` because they do not produce a new row.

**Grants and RLS are two different gates, and you need both.** `GRANT` decides whether the `authenticated` role may issue the statement at all; RLS decides which rows come back. The schema grants `select, insert, update, delete` on `contacts` to `authenticated` and revokes everything from `anonymous`, so a signed-out caller is refused before RLS is even consulted.

`FORCE ROW LEVEL SECURITY` is belt and braces: by default table owners bypass RLS, and this removes that exemption so nothing can accidentally run unfiltered.

---

## Testing

```bash
npm test
```

### What the tests verify

**`tests/validation.test.ts` — the validation contract (25 tests)**

Runs against `lib/validation.ts`, the exact module the API routes import.

- A name that is empty, whitespace-only, missing, or over 120 characters is rejected
- A valid name is trimmed before it reaches the database
- `high`, `medium`, and `low` are accepted; `urgent`, `HIGH`, `""`, `1`, `critical`, and a missing value are all rejected
- The invalid-priority message names the three allowed values, so the UI can show something useful
- Blank optional fields normalise to `null` rather than being stored as empty strings
- Edits are held to the same rules — you cannot blank a name or set an invalid priority via `PATCH`
- The `sort` and `priority` query parameters are whitelists: `?sort=name; drop table contacts` silently falls back to `created_at`

**`tests/api-contract.test.ts` — the route handler's order of operations (5 tests)**

Imports the real `POST /api/contacts` handler with the database mocked, and asserts the sequence:

- Signed out → `401`, **and the database client is never constructed**
- Empty name → `400` with `fieldErrors.name`, and nothing is inserted
- Invalid priority → `400` with the clear message, and nothing is inserted
- A valid contact → `201`, and the row sent upstream **contains no `user_id`** — proving the app relies on the database's `auth.user_id()` default rather than stamping ownership itself
- A client that maliciously includes `"user_id": "somebody_else"` has it stripped before the insert

<!-- TEST_OUTPUT -->

---

## Deployment

1. Push the repository to GitHub.
2. In Vercel, **Add New → Project**, import the repository, and accept the auto-detected Next.js settings.
3. Add the environment variables under **Settings → Environment Variables**, for Production, Preview, and Development:
   - `NEXT_PUBLIC_NEON_AUTH_URL`
   - `NEXT_PUBLIC_NEON_DATA_API_URL`
   - `NEON_AUTH_BASE_URL`
   - `NEON_AUTH_COOKIE_SECRET`
4. Deploy, and note the assigned domain.
5. In the Neon Console, add that domain to **Auth → Configuration → Trusted domains**, so Neon Auth will accept requests from it.
6. Apply `db/schema.sql` in the Neon SQL Editor if you have not already.
7. Open the public URL in a private window and run the [verification checklist](#grading-evidence).

Subsequent pushes to `main` deploy automatically.

---

## Grading evidence

<!-- EVIDENCE -->

---

## Known limitations and what I would improve next

**Limitations**

- **Email verification is off.** Sign-up grants immediate access without confirming the address. Fine for a graded exercise; not acceptable for a real product, where an unverified address is an account-takeover vector.
- **Search is a `LIKE` scan.** `ilike` across four columns is fine at the scale one person's network reaches, but it does not rank results and will not use an index. Postgres full-text search with a `tsvector` column would be the fix.
- **No pagination.** Every matching contact is fetched at once. Past a few hundred rows this becomes a noticeable payload.
- **No optimistic UI.** Every mutation waits for the round trip before the list updates. Correct, but it feels slower than it needs to.
- **No soft delete.** Deletion is permanent with only a confirmation dialog between the user and losing their notes.
- **Tests cover validation and the route contract, not the browser.** There is no end-to-end test that drives a real browser through sign-in and CRUD; the two-account privacy test was performed manually against production.
- **The `DATABASE_URL` in `.env.example` is documented but unused at runtime.** It exists for applying the schema. Keeping an unused credential in the template is a small smell.

**What I would do next, in order**

1. **A Playwright end-to-end test for the two-account privacy case**, run in CI. Right now the most important security property is verified by hand, which means it can silently regress. This is the highest-value gap.
2. **Turn on email verification**, and add password reset.
3. **Pagination plus a proper full-text search index**, so the app degrades gracefully as a network grows.
4. **Optimistic updates with rollback on failure**, so the list feels instant.
5. **A "last contacted" date and a follow-up reminder**, which is the feature that would actually change behaviour — a tracker you don't get nudged by is a tracker you stop opening.
6. **A `contact_interactions` child table** so you can log each conversation rather than appending to one notes field. It would carry the same four RLS policies, keyed off the parent's `user_id`.

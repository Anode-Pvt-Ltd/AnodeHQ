# Anode — electronics design website

Production build of the Anode marketing site and CMS, implemented against the
approved architecture and technical specification.

```bash
npm install
npm run dev          # http://localhost:3000
```

The site runs immediately with **no configuration**. Adding Supabase credentials
switches the same query layer from the seed dataset to the database — see
[Connecting Supabase](#connecting-supabase).

---

## What is here

| | |
|---|---|
| **Public routes** | 32 — home, 6 services, 7 industries, 6 case studies, process, about + team + facilities, why-anode, insights + 4 articles + topics, contact, quote, search, 3 legal, sitemap/robots/rss/manifest |
| **Admin routes** | 17 — dashboard, quotes pipeline, messages, 11 content types, media, PCB editor, navigation, settings, users, audit log |
| **API** | 11 route handlers |
| **Database** | 35 tables, 5 enums, RLS on every table, 4 storage buckets |
| **Components** | ~60, of which 19 are client components |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 ·
Supabase (Postgres, Auth, Storage) · Zod · three.js + React Three Fiber.

> **Deviation from the specification.** The spec was written against Next 15,
> Zod 3 and a set of Radix primitives. This build targets the current stable
> line (Next 16 / Zod 4) and drops 20 unused dependencies — the accordion is a
> native `<details>`, the navigation is custom, and neither needed a library.
> Everything else follows the spec.

---

## Commands

```bash
npm run dev        # development server
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint, zero warnings allowed
npm run seed:sql   # regenerate supabase/seed.sql from src/content
npm run verify:db  # run the migrations + seed + 79 assertions against real Postgres
```

### `verify:db`

Runs the **real** migration files and `seed.sql` against an in-process
Postgres (PGlite — no Docker required), then exercises the schema the way the
app does: constraints, triggers, RPC, and every row of the role matrix executed
as an actual `anon` / `authenticated` session. It is how the three bugs below
were found. Supabase's `auth`, `storage` and `pg_net` are shimmed; everything
else is the shipping SQL.

---

## How content works

Content resolves through one layer, `src/lib/queries`. Each function checks
whether Supabase is configured:

- **not configured** → returns the typed seed dataset in `src/content`
- **configured** → queries Postgres with the anon key, filtered by RLS

Components receive identical domain types either way, so connecting a database
is a configuration change rather than a code change. `supabase/seed.sql` is
**generated** from the same `src/content` modules by `scripts/gen-seed.ts`, so
the two can never drift apart.

### Connecting Supabase

```bash
cp .env.example .env.local        # fill in the three SUPABASE_* values
supabase link --project-ref <ref>
supabase db push                  # 7 migrations: tables, RLS, storage, RPC
psql "$DATABASE_URL" -f supabase/seed.sql
```

Then create a user in the Supabase dashboard and grant yourself a role:

```sql
insert into public.user_roles (user_id, role)
values ('<auth.users.id>', 'owner');
```

`/admin` explains all of this on screen until the database exists.

---

## Security

The parts worth reviewing:

- **RLS on all 35 tables**, `force row level security` so the table owner is not
  exempt either. Three policy shapes (`supabase/migrations/0006_rls.sql`):
  public content readable when published, private lead records with **no anon
  policy at all**, and system tables per-table.
- **Child tables test their parent's publication state.** Without that,
  `project_metrics` for a draft case study is readable by anyone who guesses the
  table name.
- **`quote_requests` has no anon INSERT policy.** Rows can only be created by
  the service-role client in `/api/quote`, after the gate below.
- **The gate runs in a fixed order** (`src/lib/api.ts`): honeypot → elapsed time
  → Turnstile → rate limit. Rate-limiting last means an attacker cannot burn
  someone else's window with malformed junk. A filled honeypot returns a silent
  `202` rather than a validation error naming the field.
- **`getUser()`, never `getSession()`** in any authorisation decision.
  `getSession()` only decodes the cookie and would accept a forged token.
- **Middleware never authorises.** It refreshes the session and resolves
  redirects; the gate is the admin layout plus the database.
- **Roles live in `user_roles`, not on `profiles`**, and the policy includes
  `user_id <> auth.uid()` so an owner cannot alter their own grants.
- **`audit_log` is append-only.** No role has an update or delete policy on it,
  including `owner`; rows arrive only through a `security definer` trigger.
- **IP addresses are never stored** — only `sha256(ip + IP_HASH_PEPPER)`.
- **The service-role key is imported in exactly one file**,
  `src/lib/supabase/service.ts`, guarded by `server-only`.

---

## The 3D board

No `.glb` asset existed for this build, so the hero board is **generated in
code** from `src/content/pcb.ts`: outline, mounting holes, 60 components and the
copper artwork (drawn into a canvas texture rather than geometry, which keeps
the whole board at ~3 draw calls).

That means **zero asset bytes** instead of the 3.5 MB the spec budgeted, and the
board is editable as data. `pcb_models.storage_path` is still honoured — set it
and the renderer loads a real glTF instead.

Behaviour follows spec §13:

- The poster is the LCP element and is always painted first.
- three.js loads only after `load` + idle, only while the hero is in view, and
  only on desktop with WebGL2, ≥4 GB memory and no save-data.
- Hotspots are real `<button>` elements in a DOM overlay, server-rendered so
  they are indexable, and positioned by the **same projection maths** in both
  modes (`src/lib/project3d.ts`) — the poster fallback is a loss of motion, not
  of layout.
- Per-frame updates write `style.transform` directly, never through React state.
- Two consecutive frame-rate declines unmount the canvas back to the poster.
- The admin editor mounts the same board and captures hotspot coordinates by
  **raycasting the mesh** — the numeric fields are read-only.

---

## Verified

Run against the production build on 25 August 2026:

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint` | clean, zero warnings |
| `next build` | 48 pages prerendered |
| 46 public routes | all 200, exactly one `<h1>`, `lang`, canonical, title, description |
| Every `<img>` | carries an `alt` attribute |
| Unknown slugs | 404 (`dynamicParams = false`) |
| JSON-LD | Organization, WebSite, BreadcrumbList, Service, CreativeWork, Article, FAQPage |
| Sitemap | 42 URLs, no `/admin` |
| Homepage first-load JS | 211 KB gz — three.js correctly deferred |
| Quote API | valid → 201 + reference; honeypot → silent 202; <4 s → 400; rate limit → 429 + `Retry-After` |
| Upload API | extension allow-list, 25 MB cap, editor role required |
| Hotspots | all four project inside the poster frame |
| `verify:db` | 7 migrations + seed apply clean; **79/79** assertions pass |

### Bugs found by running the SQL

The migrations had never been executed until `verify:db` existed. Three real
defects surfaced, all now fixed and covered by assertions:

1. **`has_role()` was declared before its tables.** It lived in migration 0001
   but reads `user_roles`, created in 0002. Postgres validates SQL function
   bodies at `CREATE` time, so `supabase db push` would have failed on the
   first migration of a fresh project. Moved to 0002.
2. **`search_all()` ordered by a column that did not exist.** A `UNION ALL`
   takes its output names from the first branch, where the `ts_rank()`
   expression was unaliased — so `order by rank` could not resolve. Now orders
   by ordinal.
3. **Editors could read every quote request.** `app_role` is ordered
   `viewer < sales < editor < admin < owner`, so `role >= 'sales'` also matched
   editor — contradicting the role matrix, which says content editors must not
   see commercial records. `sales` and `editor` are sibling capabilities, not
   rungs. Fixed with an explicit `public.is_sales()` predicate, mirrored in
   `lib/roles.ts` so the application check and the policy cannot disagree.

### Against the specification's budgets

- Homepage first-load **211 KB gz** vs the 180 KB target. The gap is the Next 16
  + React 19 baseline (~70 KB react-dom plus ~73 KB framework), not application
  code — the bundle contains no Zod, Supabase, sonner or three.js. Removing it
  would mean removing features rather than weight.
- **LCP, INP and CLS are not measured here.** They need a browser and a
  throttled device profile; the structural work behind them is done (poster as
  LCP element, explicit dimensions on every image, reserved 3D container) but
  the numbers are unverified.
- **No automated test suite.** Verification above was scripted against the
  running build rather than committed as Vitest/Playwright specs.

---

## Structure

```
src/
├── app/
│   ├── (site)/          public routes
│   ├── (admin)/admin/   CMS, force-dynamic, noindex
│   └── api/             11 route handlers
├── components/
│   ├── primitives/      Button, Field, Section, Badge, Reveal, Prose
│   ├── layout/          header, mega panel, drawer, footer, theme toggle
│   ├── sections/        the 12 homepage bands
│   ├── content/         cards, filters, FAQ
│   ├── pcb/             capability gate, scene, hotspots, view rail
│   ├── forms/           quote wizard, contact, newsletter
│   └── admin/           ResourceTable, EntityForm, media, hotspot editor
├── content/             typed seed dataset — the source for seed.sql
├── lib/
│   ├── supabase/        server · browser · service · middleware
│   ├── queries/         every read, tagged for cache purging
│   ├── mutations/       server actions, each starting with requireRole()
│   ├── schemas/         Zod, shared by client and server
│   └── config/          resource registry driving the whole CMS
supabase/
├── migrations/          7 files: tables, RLS, storage, triggers, RPC
└── seed.sql             generated — do not edit
scripts/
└── gen-seed.ts          regenerates seed.sql from src/content
```

## Adding a content type

Add an entry to `src/lib/config/resources.ts`. The list view, edit form, field
widgets, validation, role gating and cache purging all follow from it — there is
no new screen to write.

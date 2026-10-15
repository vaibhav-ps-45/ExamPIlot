# ExamPilot

A customizable exam planning and tracking application. Plan, organize, track and evaluate
preparation for competitive exams, university exams and certifications — with **no unwanted
automation**: the app tracks time automatically, it does not manage your life automatically.

---

## Current status

| Phase | Scope | State |
|---|---|---|
| 1 - Foundation | Monorepo, auth, PostgreSQL + Prisma, assessment CRUD, syllabus + study items | Backend complete; assessments UI done |
| 2 - Core tracking | Tracker builder, table/checklist/notes-board, custom fields, saved views, attempts, sessions | **Trackers UI done** (builder, 3 layouts, custom fields, saved views, attempts); Sessions UI pending |
| 3 - Planning | Live date calculations, manual rescheduling, bookmarks, opt-in reminders | Backend complete; reschedule + bookmark toggle available from trackers; Schedule, Saved and Reminders pages pending |
| 4 - Progress | Mock tests, analytics, dashboard | Dashboard done; Mock tests page pending |

**Pages still to build:** Syllabus, Sessions, Schedule, Saved for Later, Reminders, Notes, Mock Tests, Settings.

---

## Stack

- **Frontend** (scaffolded, not implemented): React 18, TypeScript, Vite, Tailwind CSS, Radix primitives, TanStack React Query, React Hook Form + Zod.
- **Backend**: Node 20+, Express 4, TypeScript, Prisma 5, PostgreSQL 16, Zod, JWT, bcrypt.
- **Database**: PostgreSQL 16 via Docker Compose (host port **5433**).
- **Tests**: Vitest (unit + HTTP integration).

Dependency versions are pinned exactly (no `^` or `~`) in each workspace's `package.json`.

---

## Prerequisites

- Node.js 20.11 or newer (developed on 24.18)
- Docker Desktop, for the database
- npm 10 or newer (developed on 11.16)

---

## Setup

```bash
# 1. Install dependencies (npm workspaces)
npm install

# 2. Create your environment file
cp .env.example .env
#    Then edit .env and replace both JWT secrets with real random values:
#    node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 3. Start PostgreSQL
npm run db:up

# 4. Apply migrations and generate the Prisma client
npm run db:migrate

# 5. Seed the demo workspace (optional but recommended)
npm run db:seed

# 6. Start the API
npm run dev -w @exampilot/api
```

The API listens on `http://localhost:4000`. Check it with `GET /health`.

### Demo credentials

The seed creates a demo account containing a full GATE CS workspace:

```
demo@exampilot.local
DemoPassword123!
```

It contains one assessment, 19 syllabus nodes, 3 trackers (one per implemented layout), a
saved view, 8 study items — including a deliberately overdue one and two completed ones, one
of them late — 3 practice attempts, 6 study sessions, 3 bookmarks, 2 notes, 4 mock tests with
a rising trend, and **2 explicitly opted-in reminders**. All dates are relative to the day
you run the seed, so the workspace stays realistic.

Re-running the seed is safe: it detects the existing demo account and does nothing. Pass
`--reset` to rebuild it: `npm run db:seed -- --reset`. Only the demo account is ever touched.

---

## Commands

| Command | What it does |
|---|---|
| `npm run db:up` / `npm run db:down` | Start / stop the Postgres container |
| `npm run db:migrate` | Apply migrations in development |
| `npm run db:seed` | Seed the demo workspace |
| `npm run db:studio` | Open Prisma Studio |
| `npm run dev -w @exampilot/api` | API with hot reload |
| `npm run build` | Build all workspaces |
| `npm run typecheck` | Typecheck every workspace |
| `npm test` | Run the test suite |

---

## Repository layout

```
exampilot/
├── apps/
│   ├── api/                     Express + Prisma backend
│   │   ├── prisma/
│   │   │   ├── schema.prisma    20 models
│   │   │   ├── migrations/      0001_init
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── config/          Environment validation
│   │       ├── lib/             Prisma client, errors, logger, tokens, dates
│   │       ├── middleware/      Auth, validation, error handling, rate limits
│   │       ├── modules/         One folder per domain module
│   │       └── test/            Unit and integration suites
│   └── web/                     React frontend (scaffolded, not implemented)
├── packages/
│   └── shared/                  Zod schemas and domain constants shared by both
├── docs/
│   └── API.md                   Endpoint reference
└── docker-compose.yml
```

`packages/shared` is the single source of truth for enums, layout/field matrices and request
schemas. The API validates with them; the client will too, so the two cannot drift apart.

---

## Architecture notes

**Assessment-centric.** An assessment is the workspace root; syllabus nodes, trackers, study
items, attempts, sessions, bookmarks, notes, mock tests and reminders all hang off it. Every
row is reachable from `User` through an unbroken chain of relations, which is what makes
server-side authorization checkable everywhere.

**Data separate from presentation.** `StudyItem` holds the work. `Tracker.viewConfig` (JSON)
and `TrackerColumn` rows hold only how it is displayed. That is why switching a tracker
between table, checklist and notes-board is lossless: all three render the same rows, and
fields a layout cannot show are hidden rather than deleted.

**Dates are never moved for you.** `plannedStartDate` and `dueDate` change only through
`POST /items/:id/reschedule`, which requires an explicit call, records the previous values
plus a reason in `metadata.rescheduleHistory`, and is never invoked by any other code path.
A missed deadline changes `dateStatus` to `OVERDUE`; the stored date is untouched. Completed
items are never rescheduled either.

**Time is counted once.** A session carries either a start/end pair or `manualMinutes`, never
both — enforced at the schema level. The item's `actualMinutes` is recomputed from its
sessions inside the same transaction that changes them, so the total cannot drift.

**Reminders are opt-in and nothing else creates them.** `createReminder` has exactly one
caller: the explicit `POST` endpoint. Importing a syllabus, setting a deadline, logging a
session and missing a reminder all leave the reminder table alone. This is covered by a test.

**No automatic task creation.** Nothing in the codebase creates a `StudyItem` on a schedule,
as a consequence of a missed session, or as a side effect of another action.

---

## Security

- Passwords hashed with bcrypt (cost 12). Login compares against a dummy hash when the account
  does not exist, so response timing does not reveal whether an email is registered.
- Short-lived JWT access token (15 min) held in client memory; opaque refresh token in an
  httpOnly cookie, stored only as an HMAC hash, rotated on every use. Reusing an already-rotated
  token revokes every session for that user.
- `requireAuth` re-checks the session row, so a revoked session stops working immediately even
  though its access token has not yet expired.
- Every user-owned resource is scoped on the server. Another user's id returns **404, not 403**.
- Zod validation on body, query and params; parsed values replace raw input before handlers run.
- Helmet, a CORS allowlist from `CORS_ORIGINS`, a 1 MB body cap, and rate limits on auth and
  general API routes.
- Structured logging that redacts anything whose key contains `password`, `token`,
  `authorization`, `cookie`, `secret` or `api_key`. Stack traces are never returned in production.
- `.env.example` contains placeholders only. In production the API refuses to start if either
  JWT secret still looks like a development placeholder, or if the two secrets are identical.

---

## Tests

```bash
npm test -w @exampilot/api
```

**60 tests, all passing.**

- `src/test/unit.test.ts` — 51 pure tests: calendar-day math across time zones, date-status
  derivation (proving `OVERDUE` does not mutate the date), session-duration rules including
  the double-counting case, syllabus tree assembly with orphan and depth handling, layout
  switching constraints, reminder time resolution and occurrence keys, and the validation
  rules for every request shape.
- `src/test/access.test.ts` — 9 integration tests against the real app and database:
  cross-user access returning 404 across ten endpoints, cross-user bookmarking, missing and
  forged tokens, session revocation taking effect immediately, **no reminder created as a
  side effect of import/scheduling/sessions**, an overdue date surviving a re-read unchanged,
  a double-counted session being rejected, an impossible date range being rejected, and no
  password hash or token ever appearing in a response.

Integration tests skip themselves when no database is reachable, so `npm test` stays green
without Docker. Set `SKIP_DB_TESTS=true` to skip them explicitly.

---

## Known limitations

Stated plainly, so nothing here is mistaken for finished work.

1. **No frontend.** `apps/web` has its build configuration and dependencies in place, but no
   components, routes or pages. The app cannot be used through a browser yet.
2. **Kanban is declared but not implemented.** `TrackerLayout.KANBAN` exists in the schema so
   it can be added without a migration; selecting it returns a 400. The layout registry and
   `LAYOUT_SUPPORTED_FIELDS` matrix are the extension point.
3. **Reminder delivery needs a running process.** The sweep is an in-process timer. With the
   API stopped, nothing fires. Browser notifications also need the browser open and permission
   granted. There is no push channel and no email delivery.
4. **No online examination engine.** Mock tests are manual entry and result tracking, as scoped.
5. **No calendar UI yet.** The data the calendar view needs (planned start, due date,
   completion date, days remaining) is all exposed by the API.
6. **Session revocation is per-session, not per-device**, since the user agent is recorded but
   not verified.
7. **No file attachments, social features, gamification or AI-generated plans** — deliberately
   out of MVP scope, per the product brief.

---

## What is deliberately absent

These are excluded by design, not missing by accident:

- No automatic rescheduling of tasks or deadlines.
- No reminders created implicitly, and none enabled by default.
- No new tasks or reminders generated from a missed session.
- No AI-generated study plans, social features or gamification.

The application tracks time automatically; it does not manage your life automatically.

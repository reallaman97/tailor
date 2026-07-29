# cute-job-platform

A multi-user job-application platform: superadmins curate candidate **profiles**,
team members log and track **applications** through a hiring pipeline, and an AI
step tailors a resume to each job description and exports it to PDF/DOCX.

Built with Next.js 16 (App Router, Server Actions), React 19, Prisma 7 on
Postgres, and Auth.js v5.

> **Working in this repo?** This is a customized Next.js with breaking changes
> from upstream. Read the relevant guide in `node_modules/next/dist/docs/`
> before writing framework code — see [`AGENTS.md`](./AGENTS.md).

## Features

- **Auth** — email/password (Argon2), superadmin-gated account approval,
  password reset by email, role-based access (`SUPERADMIN` / `BIDDER` / `CALLER`).
- **Profiles** — a candidate record (work history, education, skills, contact
  info) a superadmin can share across several user accounts.
- **Applications** — per-job tracker with a multi-stage pipeline, duplicate
  detection, proof-of-submission screenshots, and superadmin approval.
- **AI tailoring** — generates a job-specific resume from a profile + job
  description via OpenAI, with per-user daily cost limits and usage accounting.
- **Export** — PDF (`@react-pdf/renderer`) and DOCX, in a Modern or Classic
  template.

## Security model

- **Envelope encryption** — sensitive profile/resume fields are AES-256-GCM
  encrypted with a per-profile/per-user data encryption key (DEK), which is
  itself wrapped by an app-wide `MASTER_KEY`. Plaintext PII is never stored or
  written to logs. Date of birth and street address are *reference-only* and
  never reach tailoring, export, or the LLM.
- **Authorization** — [`src/lib/auth/require-user.ts`](src/lib/auth/require-user.ts)
  is the real boundary and re-checks the role against the database on every
  privileged action. [`src/proxy.ts`](src/proxy.ts) only redirects page
  navigations (UX), and never gates Server Actions.
- **Abuse limits** — signup, login, password-reset, and AI generation are rate
  limited atomically (advisory-locked, race-free) in
  [`src/lib/rate-limit.ts`](src/lib/rate-limit.ts).
- **HTTP headers** — CSP and the standard hardening headers are set in
  [`next.config.ts`](next.config.ts).

## Getting started

### Prerequisites

- Node.js 20+
- A Postgres database (the app uses the Prisma `pg` adapter; Neon in prod/dev).

### Setup

```bash
npm install                       # also runs `prisma generate`
cp .env.example .env              # then fill in the values below
npx prisma migrate deploy         # apply the schema
npm run dev                       # http://localhost:3000
```

Create the first superadmin (accounts otherwise start unapproved and can't log in):

```bash
npx tsx scripts/create-superadmin.ts
```

### One-command setup (schema + config + superadmin)

`npm run setup` deploys the schema, seeds the config singletons (settings +
interview stages/statuses/meeting types), and creates a superadmin — all
idempotent, so it's safe to re-run.

```bash
SUPERADMIN_EMAIL=you@example.com SUPERADMIN_PASSWORD='a-strong-password' npm run setup
```

It runs `prisma db push` (which syncs the DB directly to `schema.prisma`) then
[`scripts/setup.ts`](scripts/setup.ts). On **Vercel**, the `vercel-build` script
runs this automatically before `next build`, so every deploy provisions the
database and admin from the environment variables — no manual step. (Set
`SUPERADMIN_*`, `DATABASE_URL`, `MASTER_KEY`, and `AUTH_SECRET` in the Vercel
project.)

### Environment

All server config is declared and validated in
[`src/lib/env.ts`](src/lib/env.ts); a bad or missing value fails fast at server
start (via [`src/instrumentation.ts`](src/instrumentation.ts)) instead of mid-request.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `MASTER_KEY` | yes | base64, decodes to 32 bytes — `openssl rand -base64 32` |
| `AUTH_SECRET` | yes | Auth.js signing secret — `openssl rand -base64 32` |
| `APP_URL` | no | base URL for email links (default `http://localhost:3000`) |
| `RESEND_API_KEY` / `EMAIL_FROM` | for email | password-reset delivery |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | for AI | fallback if no key is set in Settings |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm test` | Run the test suite once (Vitest) |
| `npm run test:watch` | Watch mode |

> **Tests hit a real Postgres.** They exercise encryption, data access, and rate
> limiting end-to-end against the `DATABASE_URL` database, so point it at a
> disposable/test database. CI provisions a throwaway Postgres — see
> [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Project layout

```
src/
  app/            App Router routes, pages, and Server Actions (actions.ts)
    api/          Route Handlers (auth, PDF/screenshot/job-description export)
  components/     Shared UI (ui/ = primitives)
  lib/            Domain logic — the real work lives here
    auth/         Sessions, passwords, reset tokens, the require-* boundary
    crypto/       Envelope encryption
    profile/      Profiles, the reference-only-data boundary
    resumes/      Applications, tracking, analytics
    tailoring/    OpenAI generation + usage/cost accounting
    export/       PDF/DOCX rendering + templates
  generated/      Prisma client (git-ignored, generated)
prisma/           Schema and migrations
```

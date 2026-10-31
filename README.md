# Bloquera

Bloquera is a full-stack cryptocurrency education platform built with Next.js.
Bitcoin is the first course, with the platform designed to support additional
courses over time.

## Core stack

- Next.js 16, React 19, TypeScript, and Tailwind CSS
- Supabase Postgres and Supabase Auth
- Stripe subscriptions and billing
- Cloudflare R2 private lesson media
- OpenAI educational tutor
- Resend transactional email
- Vercel hosting, Analytics, and Speed Insights

See [docs/architecture.md](./docs/architecture.md) for current boundaries and
the approved long-term architecture.

## Prerequisites

- Node.js 24 LTS
- npm
- Git
- Docker Desktop, OrbStack, or another Docker-compatible runtime
- A Supabase Test project
- Credentials for any integrations you want to exercise locally

The complete application uses Stripe, Resend, OpenAI, Cloudflare R2, and Google
OAuth. The app can start without every optional integration, but the related
features will report that they are not configured.

## Run locally

1. Install the locked dependencies:

   ```bash
   npm ci
   ```

2. Create the local environment file:

   ```bash
   cp .env.example .env.local
   ```

3. Replace the placeholders in `.env.local` with Test/non-production values.
   At minimum, configure the public site URL and Supabase variables for
   authentication and persisted application data.

4. To work on the database, start the local Supabase stack and rebuild it from
   the ordered migrations:

   ```bash
   npm run db:start
   npm run db:reset
   ```

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000).

Detailed Supabase, Resend, Vercel, and R2 configuration is documented in
[docs/setup.md](./docs/setup.md).

## Environment variables

Use [.env.example](./.env.example) as the canonical variable list. Variables
cover:

- Site URL and Supabase
- Stripe
- OpenAI
- Resend
- Cloudflare R2

Never commit `.env.local`. Never expose service-role, Stripe, OpenAI, Resend,
R2, webhook, or signing secrets through `NEXT_PUBLIC_*` variables.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check the application without emitting files |
| `npm test` | Run the Vitest suite |
| `npm run build` | Create and type-check the production build |
| `npm run test:e2e` | Run Playwright critical-flow tests |
| `npm run db:start` | Start the local Supabase stack |
| `npm run db:reset` | Rebuild the local database from migrations |
| `npm run db:test` | Run database and RLS tests |
| `npm run db:types` | Regenerate database types from the local schema |
| `npm run video:upload -- <course> <module> <lesson> <file>` | Upload and register a lesson video |

Before opening a pull request, normally run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Run `npm run test:e2e` for changes affecting authentication, billing, learning,
video, email, routing, or other critical user flows.

## Environment mapping

| Application environment | Supabase | Stripe and external services |
| --- | --- | --- |
| Local | Test | Test/non-production credentials |
| Vercel Preview | Test | Test/non-production credentials |
| Vercel Production | Production | Live/production credentials |

Preview must never use live billing or production administrative credentials.

## Repository documentation

- [Architecture](./docs/architecture.md)
- [Service and environment setup](./docs/setup.md)
- [Contributing and Git workflow](./CONTRIBUTING.md)
- [Agent working instructions](./AGENTS.md)

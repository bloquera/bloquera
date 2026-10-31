<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Bloquera working instructions

## Product and architecture

- Bloquera is a multi-course cryptocurrency education platform. Bitcoin is the
  first course, not the permanent boundary of the product.
- Preserve the existing Next.js full-stack architecture. Do not introduce a
  separate backend, microservices, or a framework rewrite without an approved
  technical requirement.
- Treat `docs/architecture.md` as the source of truth for current boundaries,
  approved targets, and the incremental roadmap.
- Refactor incrementally. Do not move working code solely to match a proposed
  directory tree.

## Repository boundaries

- `app/`: routes, layouts, Route Handlers, and route-level composition.
- `components/`: reusable UI grouped by product area; `components/ui/` holds
  primitives.
- `content/`: current code-managed curriculum and quizzes.
- `lib/`: current domain logic and integrations. New server-only integrations
  should stay explicitly server-only and move toward `server/integrations/`
  when that boundary is introduced.
- `supabase/`: schema and, after the migration baseline exists, ordered
  migrations and seed data.
- `e2e/`: Playwright browser flows; colocated `*.test.*` files are Vitest tests.

## Security and data rules

- Never expose service-role, Stripe, OpenAI, Resend, R2, webhook, or signing
  secrets through `NEXT_PUBLIC_*` variables or client modules.
- Authentication and paid-course entitlement are separate checks. Enforce both
  on the server before returning protected content or playback credentials.
- Keep service-role access narrowly scoped and preserve Supabase RLS for
  user-owned data.
- Do not run destructive database operations, change production credentials,
  deploy to production, or modify live billing without explicit approval.
- Inspect the existing schema before adding tables. Prefer timestamped Supabase
  migrations after the migration baseline is established; do not create a
  second competing schema path.
- Keep Test/Preview and Production credentials and resources separate.

## Video and external services

- Current playback uses private Cloudflare R2 objects with short-lived signed
  URLs. Keep it working unless an approved migration changes that behavior.
- The approved long-term video direction is R2 for master storage and
  Cloudflare Stream for processed playback. Introduce Stream incrementally,
  beginning with one test lesson.
- Keep Stripe webhook processing signature-verified and idempotent. Never grant
  access based only on a browser success redirect.
- Keep OpenAI calls server-side and protect them with server-controlled usage
  and rate limits.

## Development workflow

- Use Node.js 24 LTS. Normal feature work starts from `develop` on a `feature/*`
  branch; production-ready history belongs on `main`.
- Preserve unrelated user changes and keep commits focused.
- Before writing code, inspect existing routes, services, tests, and types so
  functionality is not duplicated.
- For code changes, run the relevant focused tests, then normally run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

- Run `npm run test:e2e` for authentication, learning, billing, video, routing,
  or other user-flow changes.
- Update README or architecture documentation when setup, infrastructure,
  environment variables, or architectural decisions change.

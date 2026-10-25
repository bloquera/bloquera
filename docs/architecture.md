# Bloquera Architecture

## Status

This document records Bloquera's verified current architecture and approved
long-term direction. It is intentionally evolutionary: target sections guide
future work but do not imply that those capabilities already exist.

Bloquera is a multi-course cryptocurrency education platform. Bitcoin is the
first course; the architecture must also support future courses such as
Ethereum, stablecoins, DeFi, blockchain fundamentals, smart contracts, Layer 2
networks, tokenisation, and wallet security.

## Architectural principles

1. Keep the application full-stack in Next.js until a demonstrated requirement
   justifies another runtime or service.
2. Use TypeScript with strong checking and explicit server/client boundaries.
3. Separate route composition, UI, domain logic, persistence, and external
   integrations.
4. Enforce authentication, authorisation, and paid entitlements on the server.
5. Make courses, modules, lessons, and access rules data-driven over time.
6. Use ordered database migrations and tested RLS policies.
7. Keep Local, Preview, and Production resources and credentials separate.
8. Prefer incremental, testable refactoring over a rewrite or directory-only
   reorganisation.
9. Avoid microservices, Kubernetes, or a separate backend without an approved
   technical need.

## Current architecture

### Application

- Next.js 16 App Router, React 19, and TypeScript.
- Route groups separate marketing and authenticated dashboard experiences.
- Route Handlers provide application APIs and external webhooks.
- Next.js Proxy refreshes Supabase sessions and protects authenticated routes.
- Tailwind CSS provides styling; Vercel hosts Preview and Production.

### Learning content

- Nine Bitcoin modules and 45 lessons are defined in `content/config.ts`.
- Lesson bodies are repository-managed MDX files under `content/lessons/`.
- Quiz definitions are currently code-managed in `content/quiz-config.ts`.
- A track abstraction exists, with Bitcoin available and Ethereum planned.
- Completion, video position, quiz activity, and tutor activity are persisted
  through Supabase-backed APIs, with limited guest fallbacks where applicable.

### Authentication and email

- Supabase Auth provides email/password authentication, verification, Google
  OAuth, session management, logout, and password recovery.
- Supabase SMTP sends authentication emails through Resend.
- The application sends a one-time branded welcome email through Resend.
- Supabase RLS protects user-owned profile, progress, activity, subscription,
  and purchase data.

### Billing and entitlement

- Stripe provides Checkout, subscriptions, the customer portal, and webhooks.
- Verified webhook events update subscription and purchase state in Supabase.
- Free/Pro access is checked server-side for premium modules and lesson video
  delivery.
- The current entitlement model is membership-based, not yet course-specific.

### Video

- Original lesson videos and captions are stored privately in Cloudflare R2.
- Authenticated video endpoints verify lesson and Pro access before returning
  short-lived signed URLs.
- The player supports captions, seeking, resume, completion tracking, and error
  states.
- Current delivery is signed progressive media delivery, not adaptive Stream
  playback.

### AI

- OpenAI calls are server-side and use curriculum-aware educational prompts.
- Authenticated usage is measured from persisted activity and varies by plan.
- Guest limits currently rely partly on browser state and require stronger
  server-controlled abuse protection before significant public scale.

### Quality and delivery

- Vitest and Testing Library cover units, components, and Route Handlers.
- Playwright covers desktop and mobile critical flows.
- GitHub Actions runs install, lint, unit tests, build, and E2E tests.
- Vercel Analytics and Speed Insights provide product and performance signals.

## Approved target boundaries

The existing root-level Next.js layout remains valid. Introduce the following
boundaries only as related code is actively refactored:

```text
app/                    # routes and route-level composition
components/             # shared UI and layout primitives
content/                # repository-managed content during transition
features/
  activity/
  billing/
  courses/
  learning/
  profile/
  tutor/
  video/
server/
  env/
  integrations/
    cloudflare/
    openai/
    resend/
    stripe/
    supabase/
  observability/
  security/
supabase/
  migrations/
  seed.sql
  config.toml
e2e/
scripts/
```

Route Handlers should become thin adapters that authenticate, validate input,
call a feature service, and translate the result into an HTTP response. Feature
services must not depend on pages or UI components.

## Target data model

The current slug-based curriculum remains supported during migration. The
long-term relational model should include:

- `profiles`
- `courses`
- `modules`
- `lessons`
- `lesson_videos`
- `enrollments` or course entitlements
- `lesson_progress` and playback progress
- `subscriptions` and purchase events
- quizzes, questions, and attempts when administration requires them
- server-controlled AI usage or rate-limit records

Relationships must support multiple courses per student, ordered modules and
lessons, independently tracked progress, publication state, and different
access rules. Existing public URLs should be preserved or redirected during
model changes.

All schema changes must ultimately be represented by timestamped migrations.
Before introducing migrations, baseline the actual Test and Production schemas
so existing data is not recreated or lost. Generate Supabase TypeScript types
after the migration workflow is established.

## Authorisation model

Authentication answers who the user is. Entitlement answers which content the
user may access. These checks must remain separate.

Protected rendering, API responses, video credentials, administrative actions,
and AI allowances must use verified server-side state. Client-side gates are
presentation only. Administrative functionality requires an explicit role and
server-authorised operations; possessing a normal account is insufficient.

## Video direction

The approved long-term model is:

```text
R2 private bucket          Cloudflare Stream
master/original files  ->  encoded learner playback
                              |
Next.js entitlement check -> signed playback token
```

R2 remains the master archive. Cloudflare Stream is introduced only after its
cost and operational workflow are approved. The first implementation should
use one non-critical lesson, preserve current R2 playback as a controlled
fallback, and validate captions, token renewal, mobile playback, and progress
tracking before broader migration.

## Environments

| Environment | Application | Supabase | Stripe | Media and APIs |
| --- | --- | --- | --- | --- |
| Local | Local Next.js | Test | Test | Test/non-production credentials |
| Preview | Vercel Preview | Test | Test | Test assets and credentials |
| Production | Vercel Production | Production | Live | Production assets and credentials |

Preview must never use live billing or production administrative credentials.
Secrets remain server-only and must not use `NEXT_PUBLIC_*` names.

## Security and operational requirements

- Preserve and test RLS for every user-owned table.
- Minimise service-role operations and bind them to verified user or webhook
  context.
- Verify Stripe signatures and process event IDs idempotently.
- Replace guest-cookie-only AI protection with a shared server-side limiter.
- Validate public and private environment variables and fail unsafe Production
  configurations early.
- Ensure E2E bypass behavior cannot activate in Production.
- Add Content Security Policy and other security headers after testing required
  third-party origins.
- Add structured error reporting, request correlation, and alerts without
  logging secrets, payment data, playback tokens, or unnecessary personal data.
- Maintain backup, restore, rollback, secret-rotation, and incident runbooks.

## Testing and delivery requirements

- Standardise local and CI development on Node.js 22.
- Lint, type-check, unit-test, and build every pull request.
- Run E2E tests for changes affecting authentication, billing, learning,
  playback, email, routing, or other critical flows.
- Validate migrations from a clean database and test RLS denial cases.
- Test Stripe webhook replay/idempotency and course entitlements.
- Avoid rebuilding the application twice in the same CI job when Playwright can
  reuse the validated build.

## Incremental roadmap

1. **Reproducibility:** pin Node.js 22, add complete type-checking, validate
   environment variables, and make E2E bypass impossible in Production.
2. **Database discipline:** baseline Test and Production, introduce migrations,
   generate types, and add migration/RLS tests.
3. **Security and operations:** distributed AI/API limits, webhook idempotency,
   security headers, Sentry or equivalent monitoring, structured logs, alerts,
   and backup verification.
4. **Multi-course model:** introduce course, module, lesson, enrolment, and
   course-aware progress entities while preserving the Bitcoin experience.
5. **Video publishing:** validate Cloudflare Stream on one lesson, then add
   processing, signed playback, and publishing workflows if approved.
6. **Administration:** explicit admin roles, content management, ordering,
   publishing, video assignment, and audit records.
7. **Launch maturity:** Production smoke tests, legal pages, operational
   runbooks, and deferred SEO/product enhancements.

## Architecture decisions

Material decisions should be recorded under `docs/decisions/` as short
Architecture Decision Records. Initial candidates are:

- Use Next.js as the full-stack application.
- Use Supabase for Postgres and authentication.
- Use R2 masters with Cloudflare Stream as the approved playback target.
- Define the course-entitlement model.

An architecture change is approved only when the rationale, alternatives,
operational impact, migration plan, and rollback strategy are documented.

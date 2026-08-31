# Bloquera

Next.js 16 app for Bloquera.

## Mission

Bloquera exists to make crypto simple, clear, and accessible for everyone. We believe that understanding Bitcoin and blockchain should not feel overwhelming or technical, but instead be a calm and guided learning journey. Our goal is to break down complex ideas into easy steps, so anyone can learn with confidence.

We are building a space where curiosity is welcomed and learning happens at your own pace. With structured lessons and helpful guidance, Bloquera helps people move from confusion to clarity, empowering them to make smarter and safer decisions in the world of crypto.

## Tech Stack

| Area | Technology | Version | Purpose |
| --- | --- | --- | --- |
| Application | Next.js App Router | `^16.3.0` | Pages, server rendering, Route Handlers, metadata, and proxy-based session refresh |
| UI runtime | React and React DOM | `^19.2.8` | Component-based user interface |
| Language | TypeScript | `^5.9.3` | Typed application, server, configuration, and test code |
| Styling | Tailwind CSS and PostCSS | `^4.3.3` | Responsive design and CSS processing |
| Visual effects | OGL | `^1.0.11` | WebGL-powered interactive graphics |
| Package tooling | Node.js and npm | Node.js 22 in CI | Runtime, dependency management, and project scripts |
| Database | Supabase Postgres | Managed service | Profiles, progress, lesson-video metadata, subscriptions, and purchase records |
| Authentication | Supabase Auth, Supabase JS, and `@supabase/ssr` | `^2.112.3`, `^0.12.4` | Email/password authentication, Google OAuth, sessions, confirmation, and password recovery |
| Data security | Supabase Row Level Security | Managed service | Per-user access controls for profile, learning, and billing data |
| Payments | Stripe Node SDK | `^22.5.0` | Checkout, subscriptions, customer portal, receipts, and webhook processing |
| Transactional email | Resend API and SMTP | Managed service | Branded welcome emails and Supabase Auth email delivery |
| AI | OpenAI Node SDK | `^6.49.0` | Context-aware crypto learning tutor responses |
| Video storage | Cloudflare R2 | Managed service | Private lesson videos and WebVTT captions using the S3-compatible API and signed URLs |
| R2 integration | AWS SDK for JavaScript S3 clients | `^3.1109.0` | Object upload, retrieval, and presigned media URLs |
| Hosting | Vercel | Managed service | Preview and production deployments |
| Product analytics | Vercel Analytics | `^2.0.1` | Privacy-conscious traffic and usage analytics |
| Performance monitoring | Vercel Speed Insights | `^2.0.0` | Real-user web-performance measurements |
| Unit testing | Vitest | `^4.1.10` | Application logic, Route Handlers, and component tests |
| Component testing | Testing Library, jest-dom, and jsdom | `^16.3.2`, `^7.0.1`, `^29.1.1` | DOM rendering, interaction, and accessibility assertions |
| End-to-end testing | Playwright | `^1.62.1` | Browser-based critical-flow testing in Chromium |
| Code quality | ESLint and `eslint-config-next` | `^9.39.5`, `^16.3.0` | Static analysis and Next.js conventions |
| Continuous integration | GitHub Actions | `actions/checkout@v4`, `actions/setup-node@v4` | Install, lint, test, build, and Playwright validation |
| Source control | Git and GitHub with Gitflow | Repository workflow | Feature development, pull requests, and production promotion |
| SEO | Next.js Metadata APIs, sitemap, robots, Open Graph, and structured data | Next.js `^16.3.0` | Search indexing and social previews |

## Local Development

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful commands:

```bash
npm run lint
npm run build
```

## Auth Environments

Bloquera uses separate Supabase projects for local development and production.

Recommended setup:

- local app and Vercel Preview -> test Supabase project
- Vercel Production -> production Supabase project

Local `.env.local` should point to the local project:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-local-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_local_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_local_supabase_service_role_key
```

Vercel production environment variables should point to the production project:

```env
NEXT_PUBLIC_SITE_URL=https://bloquera.io
NEXT_PUBLIC_SUPABASE_URL=https://your-production-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_production_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_production_supabase_service_role_key
```

### Welcome email setup

Welcome emails are delivered through Resend after a new Supabase profile is
created. Email confirmation, confirmation resend, and password recovery remain
managed by Supabase Auth through its custom SMTP settings.

Verify `bloquera.io` in Resend, then configure these server-only variables:

```env
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM_EMAIL=Bloquera <hello@bloquera.io>
RESEND_REPLY_TO_EMAIL=hello@bloquera.io
```

Use separate Resend sending keys for the application welcome email and
Supabase SMTP. This allows either integration to be rotated or disabled without
affecting the other.

In Vercel, add the three variables to **Preview** with the `develop` branch
scope. Add the same variable names with a separate production key to
**Production** when releasing the feature. Enter the sender value without
surrounding quotes in the Vercel dashboard.

Before deploying the application, apply `supabase/schema.sql` to the matching
Supabase project. The schema adds one-time welcome-email eligibility, claim,
and delivery tracking. Redeploy after changing Vercel environment variables;
existing deployments do not receive new values automatically.

Supabase custom SMTP uses the following Resend connection details:

```text
Host: smtp.resend.com
Port: 465
Username: resend
Password: a dedicated Resend SMTP sending key
```

The SMTP username is always the literal lowercase value `resend`. The
`re_...` API key belongs in the password field.

Supabase URL configuration should also match each environment:

- local project `Site URL`: `http://localhost:3000`
- local project redirect URL: `http://localhost:3000/auth/callback`
- production project `Site URL`: `https://bloquera.io`
- production project redirect URL: `https://bloquera.io/auth/callback`
- preview redirect URL: `https://preview.bloquera.io/auth/callback`

Notes:

- enable Google auth separately in each Supabase project
- restart the local dev server after changing `.env.local`
- keep production secrets out of `.env.local`

## Vercel Deployment

Before deploying to Vercel, configure these project environment variables:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_PRO_YEARLY_PRICE_ID`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `RESEND_REPLY_TO_EMAIL` (optional)
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

Notes:

- Set `NEXT_PUBLIC_SITE_URL` to your production domain, `https://bloquera.io`.
- Do not copy local secret values from `.env.local` into source control.
- Vercel can use the existing `npm run build` command with this Next.js app directly.

## Git Flow

This repository uses the Gitflow branching model.

- `main` stores production-ready history.
- `develop` is the main integration branch for ongoing work.
- `feature/*` branches are created from `develop` and merged back into `develop`.
- `release/*` branches are created from `develop` and merged into both `main` and `develop`.
- `hotfix/*` branches are created from `main` and merged into both `main` and `develop`.

### Branch Model

Use these branch names:

- `feature/<short-description>`
- `release/<version>`
- `hotfix/<short-description>`

Examples:

```bash
git checkout develop
git checkout -b feature/auth-flow
git checkout -b release/0.1.0
git checkout -b hotfix/fix-login-redirect
```

### Commit Style

Keep commits focused and readable. Prefer imperative messages:

- `Add login form validation`
- `Fix build script for webpack`
- `Update CI to run lint and build`

## Pull Requests

Every pull request should:

- target the correct base branch for Gitflow
- use `develop` for feature work
- use `main` only for release and hotfix promotion
- describe the user-facing change
- reference any related issue
- include screenshots for UI changes
- pass `npm run lint` and `npm run build`

Detailed expectations live in [CONTRIBUTING.md](./CONTRIBUTING.md).

## Lesson Videos

Lesson videos are stored privately in Cloudflare R2. Upload an MP4 using its
course, module, and lesson slugs:

```bash
npm run video:upload -- bitcoin foundations what-is-money ./videos/what-is-money.mp4
```

The uploader writes to
`courses/<course-slug>/<module-slug>/<lesson-slug>.mp4`, registers that exact
key in the Supabase `lesson_videos` table, and refuses to overwrite an existing
object. To intentionally replace a video, add `--force`:

```bash
npm run video:upload -- bitcoin foundations what-is-money ./videos/what-is-money.mp4 --force
```

The R2 variables documented in `.env.example` must be present in `.env.local`.
The uploader also needs `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. Apply `supabase/schema.sql` before the first upload.
The API token needs Object Read & Write access scoped to the video bucket.
For production, use a separate read-only token in the deployed app and keep the
write-capable upload credentials local.

### Captions

Captions use WebVTT files stored privately in the same R2 bucket. Pass a
caption file to upload it alongside the video and register its metadata:

```bash
npm run video:upload -- bitcoin foundations what-is-money ./videos/what-is-money.mp4 --captions ./captions/what-is-money.en.vtt
```

The default language is `en` and the default label is `English`. Override them
with `--language en-GB --label "English (UK)"`. Caption objects are stored at
`courses/<course-slug>/<module-slug>/captions/<lesson-slug>.<language>.vtt`.

Browser caption requests require the R2 bucket CORS policy to allow `GET` from
the app's local and production origins.

### Video keyboard controls

When the video has focus:

- `Left Arrow`: skip back 10 seconds
- `Right Arrow`: skip forward 10 seconds
- `M`: mute or unmute
- `C`: turn captions on or off when a caption track is available

The settings toolbar also exposes keyboard-focusable caption and playback-speed
controls, with changes announced to screen readers.

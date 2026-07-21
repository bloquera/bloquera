# Bloquera

Next.js 16 app for Bloquera.

## Mission

Bloquera exists to make crypto simple, clear, and accessible for everyone. We believe that understanding Bitcoin and blockchain should not feel overwhelming or technical, but instead be a calm and guided learning journey. Our goal is to break down complex ideas into easy steps, so anyone can learn with confidence.

We are building a space where curiosity is welcomed and learning happens at your own pace. With structured lessons and helpful guidance, Bloquera helps people move from confusion to clarity, empowering them to make smarter and safer decisions in the world of crypto.

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

- local app -> local Supabase project
- Vercel app -> production Supabase project

Local `.env.local` should point to the local project:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-local-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_local_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_local_supabase_service_role_key
```

Vercel environment variables should point to the production project:

```env
NEXT_PUBLIC_SITE_URL=https://bloquera-chi.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://your-production-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_supabase_service_role_key
```

Supabase URL configuration should also match each environment:

- local project `Site URL`: `http://localhost:3000`
- local project redirect URL: `http://localhost:3000/auth/callback`
- production project `Site URL`: `https://bloquera-chi.vercel.app`
- production project redirect URL: `https://bloquera-chi.vercel.app/auth/callback`

Notes:

- enable Google auth separately in each Supabase project
- restart the local dev server after changing `.env.local`
- keep production secrets out of `.env.local`

## Vercel Deployment

Before deploying to Vercel, configure these project environment variables:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `STRIPE_PRO_YEARLY_PRICE_ID`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

Notes:

- Set `NEXT_PUBLIC_SITE_URL` to your production domain, for example `https://bloquera.com`.
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
lesson slug:

```bash
npm run video:upload -- what-is-money ./videos/what-is-money.mp4
```

The uploader writes to `lessons/<lesson-slug>.mp4` and refuses to overwrite an
existing object. To intentionally replace a video, add `--force`:

```bash
npm run video:upload -- what-is-money ./videos/what-is-money.mp4 --force
```

The R2 variables documented in `.env.example` must be present in `.env.local`.
The API token needs Object Read & Write access scoped to the video bucket.
For production, use a separate read-only token in the deployed app and keep the
write-capable upload credentials local.

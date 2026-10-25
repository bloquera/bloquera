# Bloquera Setup and Operations

This document contains integration and operational setup that is intentionally
kept out of the concise project README.

## Environment separation

Use separate Test and Production resources:

- Local and Vercel Preview use Supabase Test, Stripe Test, test media, and
  non-production API credentials.
- Vercel Production uses Supabase Production, Stripe Live, production media,
  and production API credentials.

Do not copy Production secrets into `.env.local` or Preview.

## Supabase

Local `.env.local` should point to Supabase Test:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-test-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_test_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_test_service_role_key
```

Vercel Production should point to Supabase Production:

```env
NEXT_PUBLIC_SITE_URL=https://bloquera.io
NEXT_PUBLIC_SUPABASE_URL=https://your-production-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_production_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
```

Configure Supabase Auth URLs per environment:

- Local Site URL: `http://localhost:3000`
- Local redirect: `http://localhost:3000/auth/callback`
- Preview redirect: `https://preview.bloquera.io/auth/callback`
- Production Site URL: `https://bloquera.io`
- Production redirect: `https://bloquera.io/auth/callback`

Enable and configure Google OAuth separately in Test and Production.

The repository currently provisions database objects through
`supabase/schema.sql`. The approved architecture replaces manual schema changes
with ordered migrations after the existing Test and Production schemas are
safely baselined.

## Resend and Supabase SMTP

The application sends a one-time welcome email through Resend:

```env
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM_EMAIL=Bloquera <hello@bloquera.io>
RESEND_REPLY_TO_EMAIL=hello@bloquera.io
```

Supabase Auth uses Resend SMTP for verification and password recovery:

```text
Host: smtp.resend.com
Port: 465
Username: resend
Password: a dedicated Resend SMTP sending key
```

Use separate sending keys for application welcome email and Supabase SMTP, and
separate Test and Production keys. The SMTP username is always the lowercase
literal `resend`; the `re_...` key belongs in the password field.

## Vercel

Configure the variables from `.env.example` in the appropriate Vercel scope:

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

Environment-variable changes require a new deployment. Vercel can use the
existing `npm run build` command.

## Lesson videos

Lesson masters and WebVTT captions are stored privately in Cloudflare R2. The
upload command writes the object and registers its exact key in Supabase:

```bash
npm run video:upload -- bitcoin foundations what-is-money ./videos/what-is-money.mp4
```

The object path is:

```text
courses/<course-slug>/<module-slug>/<lesson-slug>.mp4
```

The uploader refuses to overwrite an existing object unless `--force` is
provided:

```bash
npm run video:upload -- bitcoin foundations what-is-money ./videos/what-is-money.mp4 --force
```

Upload captions alongside the video with:

```bash
npm run video:upload -- bitcoin foundations what-is-money ./videos/what-is-money.mp4 --captions ./captions/what-is-money.en.vtt
```

Use `--language en-GB` and `--label "English (UK)"` to override caption
metadata. The uploader requires R2 write credentials plus
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

The deployed application should use R2 credentials limited to the access it
needs. Keep write-capable upload credentials local. Configure bucket CORS to
allow lesson and caption requests from the intended application origins.

## Video controls

When the lesson player has focus:

- `Left Arrow`: skip back 10 seconds
- `Right Arrow`: skip forward 10 seconds
- `M`: mute or unmute
- `C`: toggle captions when available

The player also exposes focusable caption and playback-speed controls.

# Bloquera Operations

This runbook covers the minimum checks for Preview and Production. It does not
replace provider-specific recovery procedures or authorise destructive changes.

## Verification record

The following security-and-operations checks were completed on 1 November 2026:

- the security-operations migration was applied to Production, and a subsequent
  dry run confirmed that no migrations remain pending;
- Stripe test checkout, signed webhook delivery, and duplicate-event handling
  were verified in Preview;
- the enforced Content Security Policy was verified in Preview and Production
  across public, authentication, and signed-out protected-route flows, with no
  CSP violations or required browser requests blocked;
- Production security headers were verified, including HSTS, frame denial,
  MIME-sniffing protection, permissions policy, and referrer policy; and
- the Production Vercel log stream was confirmed active, with no matching HTTP
  500, HTTP 503, CSP, or Stripe webhook errors in the preceding 24 hours.

The following checks are intentionally deferred:

- the full Production smoke test, including video playback and Stripe Live,
  until Production videos and live billing are configured;
- an isolated Supabase backup restore, because it requires a third temporary
  project that may incur cost;
- custom Vercel alert rules, because the current account scope returns
  `forbidden`; and
- usage-generating OpenAI, Resend, R2 load, and live Stripe payment tests.

## Monitoring and logs

Server security and billing events are emitted as single-line JSON records to
the Vercel runtime logs. Records include an event name, severity, timestamp,
service name, and request correlation ID. They must not include API keys,
payment details, signed media URLs, authentication tokens, or message bodies.

Create Vercel log alerts for:

- `stripe.webhook.claim_failed`
- `stripe.webhook.processing_failed`
- `stripe.webhook.failure_tracking_failed`
- repeated HTTP 500 or 503 responses
- abnormal increases in HTTP 429 responses

Connect an external monitoring destination such as Sentry only after its data
retention, PII filtering, and Production credentials are approved. Vercel logs
and alerts are the initial monitoring destination.

## Rate limiting

AI tutor allowances are consumed atomically through
`public.consume_api_rate_limit`. Subjects are stored only as SHA-256 HMAC
digests. Production requires a private `RATE_LIMIT_SECRET` of at least 32
characters whenever OpenAI is enabled.

Guest limits use the trusted forwarding address provided by the deployment
platform, with an opaque cookie identifier as the local-development fallback.
Authenticated limits use the Supabase user ID. Neither raw address nor user ID
is stored in the rate-limit table.

Expired rows are operational data and may be removed later by an approved,
tested retention job. They must not be deleted manually during an incident.

## Stripe webhook recovery

Every verified Stripe event must be claimed in `stripe_webhook_events` before
side effects run. Processed events are acknowledged without running again.
Failed events can be reclaimed, and processing claims older than ten minutes
can be recovered.

When a Stripe event fails:

1. Find the event ID in Stripe and the matching structured Vercel log.
2. Inspect the ledger status and `last_error` without changing it.
3. Correct the underlying configuration or application problem.
4. Use Stripe's dashboard to resend the same event ID.
5. Confirm the ledger becomes `processed` and the expected subscription or
   purchase state exists exactly once.

Do not grant access from the Checkout success page and do not fabricate Stripe
event rows manually.

## Database backup verification

At least monthly, and before a high-risk schema release:

1. In Supabase Production, confirm the latest managed backup completed and note
   its timestamp and retention window.
2. Confirm point-in-time recovery status if it is included in the active plan.
3. Restore a backup into an isolated, non-production project. Never restore
   over Test or Production for a verification exercise.
4. Run schema inspection, representative row counts, and critical RLS checks in
   the isolated project.
5. Record the date, backup timestamp, restore duration, verifier, and outcome in
   the team's private operational record.
6. Delete the isolated restore only after evidence has been recorded and the
   deletion has been explicitly approved.

An untested backup is not considered a verified recovery path.

## Incident checklist

1. Identify the affected environment and stop any unsafe deployment or key
   rotation already in progress.
2. Preserve provider logs and event IDs; do not log or paste secrets.
3. Contain the issue with the narrowest reversible action.
4. Rotate only credentials known or reasonably suspected to be exposed.
5. Validate authentication, entitlement, billing, video, email, and tutor paths
   after recovery as applicable.
6. Document timeline, impact, cause, remediation, and follow-up tests.

Production database restoration, credential rotation, billing changes, and
deployment rollback require explicit approval.

begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

select col_is_unique(
  'public',
  'purchase_events',
  'stripe_event_id',
  'Stripe event IDs uniquely identify purchase writes'
);

select col_is_unique(
  'public',
  'learning_activity',
  'source_event_id',
  'Source event IDs uniquely identify conversion writes'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.consume_api_rate_limit(text,text,integer,timestamptz,timestamptz)',
    'EXECUTE'
  ),
  'Authenticated users cannot consume server rate limits directly'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.consume_api_rate_limit(text,text,integer,timestamptz,timestamptz)',
    'EXECUTE'
  ),
  'Anonymous users cannot consume server rate limits directly'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.consume_api_rate_limit(text,text,integer,timestamptz,timestamptz)',
    'EXECUTE'
  ),
  'The service role can consume server rate limits'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_stripe_webhook_event(text,text)',
    'EXECUTE'
  ),
  'Authenticated users cannot claim Stripe webhook events'
);

set local role service_role;

select results_eq(
  $$select allowed from public.consume_api_rate_limit(
    'test', repeat('a', 64), 2,
    '2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z'
  )$$,
  array[true],
  'The first request in a window is allowed'
);

select results_eq(
  $$select remaining from public.consume_api_rate_limit(
    'test', repeat('a', 64), 2,
    '2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z'
  )$$,
  array[0],
  'The second request consumes the remaining allowance'
);

select results_eq(
  $$select allowed from public.consume_api_rate_limit(
    'test', repeat('a', 64), 2,
    '2026-11-01T00:00:00Z', '2026-11-02T00:00:00Z'
  )$$,
  array[false],
  'Requests over the limit are rejected atomically'
);

select results_eq(
  $$select request_count from public.api_rate_limits
    where scope = 'test' and subject_hash = repeat('a', 64)$$,
  array[2],
  'Rejected requests do not increase the stored count'
);

select results_eq(
  $$select public.claim_stripe_webhook_event('evt_processed', 'invoice.paid')$$,
  array[true],
  'A new Stripe event is claimed'
);

select results_eq(
  $$select public.claim_stripe_webhook_event('evt_processed', 'invoice.paid')$$,
  array[false],
  'A concurrently processing Stripe event is not claimed twice'
);

select lives_ok(
  $$select public.complete_stripe_webhook_event('evt_processed')$$,
  'A claimed Stripe event can be completed'
);

select results_eq(
  $$select status from public.stripe_webhook_events
    where event_id = 'evt_processed'$$,
  array['processed'::text],
  'A completed Stripe event is recorded as processed'
);

select results_eq(
  $$select public.claim_stripe_webhook_event('evt_processed', 'invoice.paid')$$,
  array[false],
  'A processed Stripe event cannot be claimed again'
);

select results_eq(
  $$select public.claim_stripe_webhook_event('evt_retry', 'invoice.payment_failed')$$,
  array[true],
  'A second new Stripe event is claimed'
);

select lives_ok(
  $$select public.fail_stripe_webhook_event('evt_retry', 'temporary failure')$$,
  'A failed Stripe event records its failure'
);

select results_eq(
  $$select public.claim_stripe_webhook_event('evt_retry', 'invoice.payment_failed')$$,
  array[true],
  'A failed Stripe event can be retried'
);

select results_eq(
  $$select attempt_count from public.stripe_webhook_events
    where event_id = 'evt_retry'$$,
  array[2],
  'Retrying a failed Stripe event increments its attempt count'
);

set local role anon;

select throws_ok(
  $$select event_id from public.stripe_webhook_events$$,
  '42501',
  'permission denied for table stripe_webhook_events',
  'Anonymous users cannot inspect the Stripe event ledger'
);

select * from finish();

rollback;

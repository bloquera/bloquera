create table public.api_rate_limits (
  scope text not null,
  subject_hash text not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (scope, subject_hash, window_start),
  constraint api_rate_limits_scope_check check (length(scope) between 1 and 100),
  constraint api_rate_limits_subject_hash_check check (length(subject_hash) = 64),
  constraint api_rate_limits_window_check check (window_end > window_start),
  constraint api_rate_limits_request_count_check check (request_count >= 0)
);

alter table public.api_rate_limits enable row level security;

create or replace function public.consume_api_rate_limit(
  target_scope text,
  target_subject_hash text,
  target_limit integer,
  target_window_start timestamptz,
  target_window_end timestamptz
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_count integer;
begin
  if target_limit <= 0 then
    raise exception 'target_limit must be positive';
  end if;

  if target_window_end <= target_window_start then
    raise exception 'target_window_end must be after target_window_start';
  end if;

  insert into public.api_rate_limits (
    scope,
    subject_hash,
    window_start,
    window_end,
    request_count
  )
  values (
    target_scope,
    target_subject_hash,
    target_window_start,
    target_window_end,
    1
  )
  on conflict (scope, subject_hash, window_start)
  do update set
    request_count = public.api_rate_limits.request_count + 1,
    window_end = excluded.window_end,
    updated_at = timezone('utc'::text, now())
  where public.api_rate_limits.request_count < target_limit
  returning request_count into next_count;

  return query select
    next_count is not null,
    greatest(target_limit - coalesce(next_count, target_limit), 0),
    target_window_end;
end;
$$;

revoke all on table public.api_rate_limits from public, anon, authenticated;
revoke all on function public.consume_api_rate_limit(text, text, integer, timestamptz, timestamptz)
  from public, anon, authenticated;
grant all on table public.api_rate_limits to service_role;
grant execute on function public.consume_api_rate_limit(text, text, integer, timestamptz, timestamptz)
  to service_role;

create index api_rate_limits_window_end_idx
on public.api_rate_limits (window_end);

alter table public.purchase_events
add column stripe_event_id text;

alter table public.purchase_events
add constraint purchase_events_stripe_event_id_key unique (stripe_event_id);

alter table public.learning_activity
add column source_event_id text;

alter table public.learning_activity
add constraint learning_activity_source_event_id_key unique (source_event_id);

create table public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  status text not null default 'processing',
  attempt_count integer not null default 1,
  claimed_at timestamptz not null default timezone('utc'::text, now()),
  processed_at timestamptz,
  last_error text,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint stripe_webhook_events_status_check
    check (status in ('processing', 'processed', 'failed')),
  constraint stripe_webhook_events_attempt_count_check check (attempt_count > 0)
);

alter table public.stripe_webhook_events enable row level security;

create or replace function public.claim_stripe_webhook_event(
  target_event_id text,
  target_event_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean;
begin
  insert into public.stripe_webhook_events (event_id, event_type)
  values (target_event_id, target_event_type)
  on conflict (event_id)
  do update set
    status = 'processing',
    attempt_count = public.stripe_webhook_events.attempt_count + 1,
    claimed_at = timezone('utc'::text, now()),
    last_error = null,
    updated_at = timezone('utc'::text, now())
  where public.stripe_webhook_events.status = 'failed'
     or (
       public.stripe_webhook_events.status = 'processing'
       and public.stripe_webhook_events.claimed_at < timezone('utc'::text, now()) - interval '10 minutes'
     )
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

create or replace function public.complete_stripe_webhook_event(target_event_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.stripe_webhook_events
  set
    status = 'processed',
    processed_at = timezone('utc'::text, now()),
    last_error = null,
    updated_at = timezone('utc'::text, now())
  where event_id = target_event_id
    and status = 'processing';
$$;

create or replace function public.fail_stripe_webhook_event(
  target_event_id text,
  target_error text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.stripe_webhook_events
  set
    status = 'failed',
    last_error = left(target_error, 500),
    updated_at = timezone('utc'::text, now())
  where event_id = target_event_id
    and status = 'processing';
$$;

revoke all on table public.stripe_webhook_events from public, anon, authenticated;
revoke all on function public.claim_stripe_webhook_event(text, text)
  from public, anon, authenticated;
revoke all on function public.complete_stripe_webhook_event(text)
  from public, anon, authenticated;
revoke all on function public.fail_stripe_webhook_event(text, text)
  from public, anon, authenticated;
grant all on table public.stripe_webhook_events to service_role;
grant execute on function public.claim_stripe_webhook_event(text, text) to service_role;
grant execute on function public.complete_stripe_webhook_event(text) to service_role;
grant execute on function public.fail_stripe_webhook_event(text, text) to service_role;

create index stripe_webhook_events_status_updated_idx
on public.stripe_webhook_events (status, updated_at);

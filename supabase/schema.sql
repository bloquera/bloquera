create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  stripe_customer_id text unique,
  avatar_url text,
  bio text,
  timezone text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists stripe_customer_id text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists timezone text;
alter table public.profiles add column if not exists created_at timestamptz not null default timezone('utc'::text, now());
alter table public.profiles add column if not exists welcome_email_claimed_at timestamptz;
alter table public.profiles add column if not exists welcome_email_eligible_at timestamptz;
alter table public.profiles add column if not exists welcome_email_sent_at timestamptz;

create or replace function public.claim_welcome_email(target_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set welcome_email_claimed_at = now()
  where id = target_user_id
    and welcome_email_eligible_at is not null
    and welcome_email_sent_at is null
    and (
      welcome_email_claimed_at is null
      or welcome_email_claimed_at < now() - interval '10 minutes'
    );

  return found;
end;
$$;

revoke all on function public.claim_welcome_email(uuid) from public;
grant execute on function public.claim_welcome_email(uuid) to service_role;

create unique index if not exists profiles_stripe_customer_id_key
on public.profiles (stripe_customer_id)
where stripe_customer_id is not null;

create table if not exists public.lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_slug text not null,
  completed_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, lesson_slug)
);

create table if not exists public.lesson_videos (
  lesson_slug text primary key,
  video_key text not null unique,
  captions_key text,
  captions_language text not null default 'en',
  captions_label text not null default 'English',
  duration_seconds integer,
  is_available boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint lesson_videos_duration_seconds_check
    check (duration_seconds is null or duration_seconds > 0)
);

create table if not exists public.video_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_slug text not null,
  position_seconds double precision not null default 0,
  duration_seconds double precision not null,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (user_id, lesson_slug),
  constraint video_progress_position_check check (position_seconds >= 0),
  constraint video_progress_duration_check check (duration_seconds > 0),
  constraint video_progress_position_duration_check
    check (position_seconds <= duration_seconds)
);

alter table public.lesson_videos add column if not exists video_key text;
alter table public.lesson_videos add column if not exists captions_key text;
alter table public.lesson_videos add column if not exists captions_language text not null default 'en';
alter table public.lesson_videos add column if not exists captions_label text not null default 'English';
alter table public.lesson_videos add column if not exists duration_seconds integer;
alter table public.lesson_videos add column if not exists is_available boolean not null default true;
alter table public.lesson_videos add column if not exists created_at timestamptz not null default timezone('utc'::text, now());
alter table public.lesson_videos add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table public.video_progress add column if not exists position_seconds double precision not null default 0;
alter table public.video_progress add column if not exists duration_seconds double precision;
alter table public.video_progress add column if not exists completed_at timestamptz;
alter table public.video_progress add column if not exists created_at timestamptz not null default timezone('utc'::text, now());
alter table public.video_progress add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

create unique index if not exists lesson_videos_video_key_key
on public.lesson_videos (video_key);

create table if not exists public.learning_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null,
  lesson_slug text not null,
  lesson_title text not null,
  activity_context text,
  correct_count integer,
  total_questions integer,
  passed boolean,
  response_preview text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.learning_activity add column if not exists activity_context text;
alter table public.learning_activity add column if not exists response_preview text;

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan_slug text not null default 'free',
  status text not null default 'inactive',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.purchase_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id text,
  stripe_invoice_id text,
  stripe_checkout_session_id text,
  event_type text not null,
  amount_cents integer,
  currency text,
  status text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.subscriptions add column if not exists stripe_customer_id text;
alter table public.subscriptions add column if not exists stripe_subscription_id text;
alter table public.subscriptions add column if not exists stripe_price_id text;
alter table public.subscriptions add column if not exists plan_slug text not null default 'free';
alter table public.subscriptions add column if not exists status text not null default 'inactive';
alter table public.subscriptions add column if not exists current_period_start timestamptz;
alter table public.subscriptions add column if not exists current_period_end timestamptz;
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;
alter table public.subscriptions add column if not exists created_at timestamptz not null default timezone('utc'::text, now());
alter table public.subscriptions add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

alter table public.purchase_events add column if not exists subscription_id text;
alter table public.purchase_events add column if not exists stripe_invoice_id text;
alter table public.purchase_events add column if not exists stripe_checkout_session_id text;
alter table public.purchase_events add column if not exists event_type text not null default 'invoice.paid';
alter table public.purchase_events add column if not exists amount_cents integer;
alter table public.purchase_events add column if not exists currency text;
alter table public.purchase_events add column if not exists status text;
alter table public.purchase_events add column if not exists created_at timestamptz not null default timezone('utc'::text, now());

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
set public = excluded.public;

alter table public.profiles enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.lesson_videos enable row level security;
alter table public.video_progress enable row level security;
alter table public.learning_activity enable row level security;
alter table public.subscriptions enable row level security;
alter table public.purchase_events enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can read their own lesson progress" on public.lesson_progress;
drop policy if exists "Users can insert their own lesson progress" on public.lesson_progress;
drop policy if exists "Users can delete their own lesson progress" on public.lesson_progress;
drop policy if exists "Authenticated users can read available lesson videos" on public.lesson_videos;
drop policy if exists "Users can read their own video progress" on public.video_progress;
drop policy if exists "Users can insert their own video progress" on public.video_progress;
drop policy if exists "Users can update their own video progress" on public.video_progress;
drop policy if exists "Users can read their own learning activity" on public.learning_activity;
drop policy if exists "Users can insert their own learning activity" on public.learning_activity;
drop policy if exists "Users can delete their own learning activity" on public.learning_activity;
drop policy if exists "Users can read their own subscriptions" on public.subscriptions;
drop policy if exists "Users can read their own purchase events" on public.purchase_events;
drop policy if exists "Users can upload their own avatars" on storage.objects;
drop policy if exists "Users can update their own avatars" on storage.objects;
drop policy if exists "Users can delete their own avatars" on storage.objects;

create policy "Users can read their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Users can read their own lesson progress"
on public.lesson_progress
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own lesson progress"
on public.lesson_progress
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete their own lesson progress"
on public.lesson_progress
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Authenticated users can read available lesson videos"
on public.lesson_videos
for select
to authenticated
using (is_available = true);

create policy "Users can read their own video progress"
on public.video_progress
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own video progress"
on public.video_progress
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their own video progress"
on public.video_progress
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read their own learning activity"
on public.learning_activity
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert their own learning activity"
on public.learning_activity
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can delete their own learning activity"
on public.learning_activity
for delete
to authenticated
using (auth.uid() = user_id);

create policy "Users can read their own subscriptions"
on public.subscriptions
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can read their own purchase events"
on public.purchase_events
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can upload their own avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can update their own avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can delete their own avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

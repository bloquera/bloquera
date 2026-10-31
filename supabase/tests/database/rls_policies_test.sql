begin;

create extension if not exists pgtap with schema extensions;

select plan(26);

insert into auth.users (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'user-one@bloquera.test'),
  ('22222222-2222-4222-8222-222222222222', 'user-two@bloquera.test');

insert into public.profiles (id, email)
values
  ('11111111-1111-4111-8111-111111111111', 'user-one@bloquera.test'),
  ('22222222-2222-4222-8222-222222222222', 'user-two@bloquera.test');

insert into public.lesson_progress (user_id, lesson_slug)
values
  ('11111111-1111-4111-8111-111111111111', 'user-one-lesson'),
  ('22222222-2222-4222-8222-222222222222', 'user-two-lesson');

insert into public.video_progress (
  user_id,
  lesson_slug,
  position_seconds,
  duration_seconds
)
values
  ('11111111-1111-4111-8111-111111111111', 'user-one-video', 10, 100),
  ('22222222-2222-4222-8222-222222222222', 'user-two-video', 20, 100);

insert into public.learning_activity (
  user_id,
  activity_type,
  lesson_slug,
  lesson_title
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'lesson_completed',
    'user-one-activity',
    'User one activity'
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'lesson_completed',
    'user-two-activity',
    'User two activity'
  );

insert into public.lesson_videos (lesson_slug, video_key, is_available)
values
  ('available-video', 'courses/test/available.mp4', true),
  ('unavailable-video', 'courses/test/unavailable.mp4', false);

insert into public.subscriptions (user_id, plan_slug, status)
values
  ('11111111-1111-4111-8111-111111111111', 'pro_monthly', 'active'),
  ('22222222-2222-4222-8222-222222222222', 'free', 'inactive');

insert into public.purchase_events (user_id, event_type)
values
  ('11111111-1111-4111-8111-111111111111', 'invoice.paid'),
  ('22222222-2222-4222-8222-222222222222', 'invoice.paid');

insert into storage.objects (bucket_id, name)
values ('avatars', '22222222-2222-4222-8222-222222222222/existing.png');

set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';

select results_eq(
  $$select email from public.profiles order by email$$,
  array['user-one@bloquera.test'::text],
  'A user reads only their own profile'
);

select results_eq(
  $$update public.profiles
    set display_name = 'User One'
    where id = '11111111-1111-4111-8111-111111111111'
    returning display_name$$,
  array['User One'::text],
  'A user updates their own profile'
);

select is_empty(
  $$update public.profiles
    set display_name = 'Not allowed'
    where id = '22222222-2222-4222-8222-222222222222'
    returning id$$,
  'A user cannot update another profile'
);

select results_eq(
  $$select lesson_slug from public.lesson_progress order by lesson_slug$$,
  array['user-one-lesson'::text],
  'A user reads only their own lesson progress'
);

select results_eq(
  $$insert into public.lesson_progress (user_id, lesson_slug)
    values (
      '11111111-1111-4111-8111-111111111111',
      'user-one-new-lesson'
    ) returning lesson_slug$$,
  array['user-one-new-lesson'::text],
  'A user inserts their own lesson progress'
);

select throws_ok(
  $$insert into public.lesson_progress (user_id, lesson_slug)
    values (
      '22222222-2222-4222-8222-222222222222',
      'cross-user-lesson'
    )$$,
  '42501',
  'new row violates row-level security policy for table "lesson_progress"',
  'A user cannot insert lesson progress for another user'
);

select is_empty(
  $$delete from public.lesson_progress
    where user_id = '22222222-2222-4222-8222-222222222222'
    returning lesson_slug$$,
  'A user cannot delete another user lesson progress'
);

select results_eq(
  $$select lesson_slug from public.video_progress order by lesson_slug$$,
  array['user-one-video'::text],
  'A user reads only their own video progress'
);

select results_eq(
  $$update public.video_progress
    set position_seconds = 30
    where user_id = '11111111-1111-4111-8111-111111111111'
    returning position_seconds$$,
  array[30::double precision],
  'A user updates their own video progress'
);

select is_empty(
  $$update public.video_progress
    set position_seconds = 30
    where user_id = '22222222-2222-4222-8222-222222222222'
    returning user_id$$,
  'A user cannot update another user video progress'
);

select results_eq(
  $$select lesson_slug from public.learning_activity order by lesson_slug$$,
  array['user-one-activity'::text],
  'A user reads only their own learning activity'
);

select results_eq(
  $$insert into public.learning_activity (
      user_id,
      activity_type,
      lesson_slug,
      lesson_title
    ) values (
      '11111111-1111-4111-8111-111111111111',
      'lesson_completed',
      'user-one-new-activity',
      'User one new activity'
    ) returning lesson_slug$$,
  array['user-one-new-activity'::text],
  'A user inserts their own learning activity'
);

select throws_ok(
  $$insert into public.learning_activity (
      user_id,
      activity_type,
      lesson_slug,
      lesson_title
    ) values (
      '22222222-2222-4222-8222-222222222222',
      'lesson_completed',
      'cross-user-activity',
      'Cross-user activity'
    )$$,
  '42501',
  'new row violates row-level security policy for table "learning_activity"',
  'A user cannot insert learning activity for another user'
);

select is_empty(
  $$delete from public.learning_activity
    where user_id = '22222222-2222-4222-8222-222222222222'
    returning user_id$$,
  'A user cannot delete another user learning activity'
);

select results_eq(
  $$select lesson_slug from public.lesson_videos order by lesson_slug$$,
  array['available-video'::text],
  'Authenticated users read only available lesson videos'
);

select results_eq(
  $$select plan_slug from public.subscriptions order by plan_slug$$,
  array['pro_monthly'::text],
  'A user reads only their own subscription'
);

select results_eq(
  $$select count(*) from public.purchase_events$$,
  array[1::bigint],
  'A user reads only their own purchase events'
);

select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values (
      'avatars',
      '11111111-1111-4111-8111-111111111111/new.png'
    )$$,
  'A user uploads an avatar inside their own folder'
);

select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values (
      'avatars',
      '22222222-2222-4222-8222-222222222222/not-allowed.png'
    )$$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'A user cannot upload an avatar inside another user folder'
);

select is_empty(
  $$update storage.objects
    set name = '22222222-2222-4222-8222-222222222222/changed.png'
    where name = '22222222-2222-4222-8222-222222222222/existing.png'
    returning name$$,
  'A user cannot update another user avatar'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Users can delete their own avatars'
      and cmd = 'DELETE'
      and roles = array['authenticated'::name]
  ),
  'Avatar deletion is protected by an authenticated-user policy'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_welcome_email(uuid)',
    'EXECUTE'
  ),
  'Authenticated users cannot execute the welcome-email claim function'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.claim_welcome_email(uuid)',
    'EXECUTE'
  ),
  'Anonymous users cannot execute the welcome-email claim function'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.claim_welcome_email(uuid)',
    'EXECUTE'
  ),
  'The service role can execute the welcome-email claim function'
);

set local role anon;
set local request.jwt.claim.sub = '';

select is_empty(
  $$select id from public.profiles$$,
  'Anonymous users cannot read profiles'
);

select is_empty(
  $$select lesson_slug from public.lesson_videos$$,
  'Anonymous users cannot read lesson-video metadata'
);

select * from finish();

rollback;

-- Security-definer functions must not inherit Supabase's default execute
-- grants for client-facing roles.
revoke all on function public.claim_welcome_email(uuid) from public;
revoke all on function public.claim_welcome_email(uuid) from anon;
revoke all on function public.claim_welcome_email(uuid) from authenticated;
grant execute on function public.claim_welcome_email(uuid) to service_role;

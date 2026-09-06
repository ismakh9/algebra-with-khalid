-- Allow students from either school email domain. Verification and teacher
-- permissions continue to be enforced by the existing session triggers and RLS.
create or replace function public.is_school_email(email text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(length(email) <= 254 and
    lower(email) ~ '^[a-z0-9]([a-z0-9._%+\-]*[a-z0-9])?@(abaarsoschool|studentabaarso)[.]org$'
    and split_part(email, '@', 1) not like '%..%', false);
$$;

create or replace function private.require_school_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_school_email(new.email) then
    raise exception 'Use your @abaarsoschool.org or @studentabaarso.org email address.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.before_school_user_created(event jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case when public.is_school_email(event->'user'->>'email') then '{}'::jsonb
    else jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Use your @abaarsoschool.org or @studentabaarso.org email address.')) end;
$$;

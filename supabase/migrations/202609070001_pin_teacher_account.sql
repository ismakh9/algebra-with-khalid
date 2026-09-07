-- Pin teacher access to an existing account BEFORE allowing unverified signup.
-- A new installation must explicitly assign user_id after creating its teacher.
alter table private.teachers add column user_id uuid unique references auth.users(id) on delete set null;
update private.teachers t set user_id = u.id from auth.users u
where lower(u.email) = t.email and u.email_confirmed_at is not null;

create or replace function public.is_teacher() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users u join private.teachers t
    on t.user_id = u.id and t.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null);
$$;

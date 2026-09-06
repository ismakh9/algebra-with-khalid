-- Apply to a dedicated Algebra with Khalid Supabase project.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create function public.is_school_email(email text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(length(email) <= 254 and
    lower(email) ~ '^[a-z0-9]([a-z0-9._%+\-]*[a-z0-9])?@abaarsoschool[.]org$'
    and split_part(email, '@', 1) not like '%..%', false);
$$;

create table private.teachers (
  email text primary key check (public.is_school_email(email) and email = lower(email))
);
insert into private.teachers values ('kismail@abaarsoschool.org');

create function public.is_school_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users u where u.id = auth.uid()
    and u.email_confirmed_at is not null and public.is_school_email(u.email));
$$;
create function public.is_teacher() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users u join private.teachers t on t.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null);
$$;

create table public.student_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (public.is_school_email(email)),
  joined_at timestamptz not null default now(),
  last_login timestamptz,
  level integer not null default 1 check (level between 1 and 1000000),
  correct integer not null default 0 check (correct >= 0)
);
create table public.login_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.student_profiles(id) on delete cascade,
  session_id uuid not null unique,
  created_at timestamptz not null default now()
);
create index on public.login_events(user_id, created_at desc);

create table public.challenge_questions (
  id uuid primary key,
  user_id uuid not null references public.student_profiles(id) on delete cascade,
  equation text not null check (length(equation) between 1 and 240),
  topic text not null,
  level integer not null check (level between 1 and 1000000),
  solved_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.challenge_questions(user_id, created_at desc);
create table public.activity_events (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  user_id uuid not null references public.student_profiles(id) on delete cascade,
  kind text not null check (kind in ('solve','practice','challenge_view','challenge_answer')),
  equation text not null check (length(equation) between 1 and 240),
  topic text not null check (length(topic) between 1 and 80),
  answer text check (length(answer) <= 240),
  correct boolean,
  result text not null check (length(result) <= 40),
  level integer,
  question_id uuid references public.challenge_questions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);
create index on public.activity_events(user_id, created_at desc);
create index on public.activity_events(created_at desc);

alter table public.student_profiles enable row level security;
alter table public.login_events enable row level security;
alter table public.challenge_questions enable row level security;
alter table public.activity_events enable row level security;
revoke all on public.student_profiles, public.login_events, public.challenge_questions, public.activity_events from anon, authenticated;
grant select on public.student_profiles, public.login_events, public.challenge_questions, public.activity_events to authenticated;
grant all on public.student_profiles, public.login_events, public.challenge_questions, public.activity_events to service_role;
grant usage, select on all sequences in schema public to service_role;
create policy profiles_read on public.student_profiles for select to authenticated using
  (public.is_school_user() and (id = auth.uid() or public.is_teacher()));
create policy logins_read on public.login_events for select to authenticated using
  (public.is_school_user() and (user_id = auth.uid() or public.is_teacher()));
create policy questions_read on public.challenge_questions for select to authenticated using
  (public.is_school_user() and (user_id = auth.uid() or public.is_teacher()));
create policy activity_read on public.activity_events for select to authenticated using
  (public.is_school_user() and (user_id = auth.uid() or public.is_teacher()));

-- A database guard enforces the domain even if a caller bypasses the website.
create function private.require_school_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_school_email(new.email) then
    raise exception 'Use your @abaarsoschool.org email address.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger require_school_email before insert or update of email on auth.users
for each row execute function private.require_school_email();

-- Auth inserts a session only after successful verification. Refreshes and page
-- reloads do not create extra login events. The browser cannot forge this log.
create function private.record_school_login() returns trigger
language plpgsql security definer set search_path = '' as $$
declare account auth.users%rowtype;
begin
  select * into account from auth.users where id = new.user_id;
  if account.email_confirmed_at is null or not public.is_school_email(account.email) then
    raise exception 'A verified school email is required.' using errcode = '42501';
  end if;
  insert into public.student_profiles(id, email, last_login)
    values(account.id, lower(account.email), now())
    on conflict(id) do update set email = excluded.email, last_login = excluded.last_login;
  insert into public.login_events(user_id, session_id) values(account.id, new.id)
    on conflict(session_id) do nothing;
  return new;
end;
$$;
create trigger record_school_login after insert on auth.sessions
for each row execute function private.record_school_login();

create function public.before_school_user_created(event jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select case when public.is_school_email(event->'user'->>'email') then '{}'::jsonb
    else jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Use your @abaarsoschool.org email address.')) end;
$$;
revoke all on function public.before_school_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.before_school_user_created(jsonb) to supabase_auth_admin;

create function public.get_school_account() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',p.id,'email',p.email,'role',case when public.is_teacher() then 'teacher' else 'student' end,
    'level',p.level,'correct',p.correct)
  from public.student_profiles p where p.id = auth.uid() and public.is_school_user();
$$;

-- Only the Edge Function may write results. It verifies the JWT and grades
-- equations using the same exact solver; it never trusts a browser's score.
create function public.save_school_activity(
  p_user uuid, p_request uuid, p_kind text, p_equation text, p_topic text,
  p_answer text default null, p_correct boolean default null, p_result text default 'viewed',
  p_question uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare profile public.student_profiles%rowtype; question public.challenge_questions%rowtype; inserted_id bigint;
begin
  select * into profile from public.student_profiles where id = p_user for update;
  if profile.id is null then raise exception 'Account missing'; end if;
  if exists(select 1 from public.activity_events where user_id=p_user and request_id=p_request) then
    return jsonb_build_object('level',profile.level,'correct',profile.correct);
  end if;
  if (select count(*) from public.activity_events where user_id=p_user and created_at > now()-interval '1 minute') >= 120 then
    raise exception 'Too many requests. Please wait a minute.';
  end if;
  if p_kind in ('challenge_view','challenge_answer') then
    select * into question from public.challenge_questions where id=p_question and user_id=p_user for update;
    if question.id is null then raise exception 'Challenge not found'; end if;
    p_equation := question.equation; p_topic := question.topic;
  elsif p_kind not in ('solve','practice') then raise exception 'Invalid activity';
  end if;
  insert into public.activity_events(request_id,user_id,kind,equation,topic,answer,correct,result,level,question_id)
    values(p_request,p_user,p_kind,p_equation,p_topic,p_answer,p_correct,p_result,question.level,p_question)
    returning id into inserted_id;
  if p_kind='challenge_answer' and p_correct and question.solved_at is null then
    update public.challenge_questions set solved_at=now() where id=question.id;
    if profile.level=question.level and profile.level<1000000 then
      update public.student_profiles set level=level+1,correct=correct+1 where id=p_user returning * into profile;
    end if;
  end if;
  return jsonb_build_object('level',profile.level,'correct',profile.correct);
end;
$$;
revoke all on function public.save_school_activity(uuid,uuid,text,text,text,text,boolean,text,uuid) from public, anon, authenticated;
grant execute on function public.save_school_activity(uuid,uuid,text,text,text,text,boolean,text,uuid) to service_role;

-- Creating the question and recording its view are one transaction. The level
-- must still match when the profile lock is acquired (including across tabs).
create function public.create_school_challenge(p_user uuid, p_request uuid, p_equation text, p_topic text, p_level integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare profile public.student_profiles%rowtype; question public.challenge_questions%rowtype; progress jsonb;
begin
  select * into profile from public.student_profiles where id=p_user for update;
  if profile.id is null then raise exception 'Account missing'; end if;
  select * into question from public.challenge_questions where id=p_request and user_id=p_user;
  if question.id is null then
    if profile.level<>p_level then raise exception 'Level changed. Please try again.'; end if;
    insert into public.challenge_questions(id,user_id,equation,topic,level)
      values(p_request,p_user,p_equation,p_topic,p_level) returning * into question;
  end if;
  progress := public.save_school_activity(p_user,p_request,'challenge_view',question.equation,question.topic,p_question=>question.id);
  return jsonb_build_object('question',to_jsonb(question),'progress',progress);
end;
$$;
revoke all on function public.create_school_challenge(uuid,uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.create_school_challenge(uuid,uuid,text,text,integer) to service_role;

create function public.teacher_dashboard(p_days integer default 30, p_student uuid default null,
  p_kind text default null, p_topic text default null, p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare since timestamptz; report jsonb;
begin
  if not public.is_teacher() then raise exception 'Teacher access required' using errcode='42501'; end if;
  if p_days not in (7,30,90) or p_page<0 or p_page>10000 then raise exception 'Invalid filters'; end if;
  since := now()-make_interval(days=>p_days);
  with filtered as (
    select a.*,p.email from public.activity_events a join public.student_profiles p on p.id=a.user_id
    where a.created_at>=since and (p_student is null or a.user_id=p_student)
      and not exists(select 1 from private.teachers t where t.email=p.email)
      and (p_kind is null or a.kind=p_kind) and (p_topic is null or a.topic=p_topic)
  ), signins as (
    select l.*,p.email from public.login_events l join public.student_profiles p on p.id=l.user_id
    where l.created_at>=since and (p_student is null or l.user_id=p_student)
      and not exists(select 1 from private.teachers t where t.email=p.email)
  ), students as (
    select p.id,p.email,p.joined_at,p.last_login,p.level,
      (select count(*) from public.login_events l where l.user_id=p.id and l.created_at>=since) logins,
      (select count(*) from public.activity_events a where a.user_id=p.id and a.created_at>=since and a.kind<>'challenge_answer') questions,
      (select count(*) from public.activity_events a where a.user_id=p.id and a.created_at>=since and a.correct is not null) attempts,
      (select count(*) from public.activity_events a where a.user_id=p.id and a.created_at>=since and a.correct=true) correct
    from public.student_profiles p where not exists(select 1 from private.teachers t where t.email=p.email)
  ) select jsonb_build_object(
    'summary',jsonb_build_object('students',(select count(*) from students), 'logins',(select count(*) from signins),
      'questions',(select count(*) from filtered where kind<>'challenge_answer'),
      'attempts',(select count(*) from filtered where correct is not null),'correct',(select count(*) from filtered where correct=true)),
    'students',coalesce((select jsonb_agg(s order by last_login desc nulls last) from students s),'[]'::jsonb),
    'topics',coalesce((select jsonb_agg(t order by count desc) from (select topic,count(*) count from filtered where kind<>'challenge_answer' group by topic) t),'[]'::jsonb),
    'logins',coalesce((select jsonb_agg(l order by created_at desc) from (select email,created_at from signins order by created_at desc limit 20) l),'[]'::jsonb),
    'activities',coalesce((select jsonb_agg(a order by created_at desc,id desc) from (select * from filtered order by created_at desc,id desc limit 50 offset p_page*50) a),'[]'::jsonb),
    'total',(select count(*) from filtered)) into report;
  return report;
end;
$$;

revoke all on function public.is_school_user(), public.is_teacher(), public.get_school_account(), public.teacher_dashboard(integer,uuid,text,text,integer) from public, anon;
grant execute on function public.is_school_user(), public.is_teacher(), public.get_school_account(), public.teacher_dashboard(integer,uuid,text,text,integer) to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

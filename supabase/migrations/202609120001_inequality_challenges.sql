-- A separate progress track preserves students' existing equation levels.
create table public.inequality_progress (
  user_id uuid primary key references public.student_profiles(id) on delete cascade,
  level integer not null default 1 check (level between 1 and 1000000),
  correct integer not null default 0 check (correct >= 0)
);
alter table public.inequality_progress enable row level security;
revoke all on public.inequality_progress from anon, authenticated;
grant select on public.inequality_progress to authenticated;
grant all on public.inequality_progress to service_role;
create policy inequality_progress_read on public.inequality_progress for select to authenticated
  using (public.is_school_user() and (user_id=auth.uid() or public.is_teacher()));

create function public.create_inequality_challenge(p_user uuid, p_request uuid, p_equation text, p_topic text, p_level integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare progress public.inequality_progress%rowtype; question public.challenge_questions%rowtype;
begin
  insert into public.inequality_progress(user_id) values(p_user) on conflict do nothing;
  select * into progress from public.inequality_progress where user_id=p_user for update;
  select * into question from public.challenge_questions where id=p_request and user_id=p_user;
  if question.id is not null then
    if question.topic not like 'Inequalities:%' then raise exception 'Request ID already used'; end if;
  else
    if progress.level<>p_level then raise exception 'Level changed'; end if;
    if p_topic not like 'Inequalities:%' then raise exception 'Invalid topic'; end if;
    if (select count(*) from public.activity_events where user_id=p_user and created_at>now()-interval '1 minute') >= 120 then raise exception 'Too many requests'; end if;
    insert into public.challenge_questions(id,user_id,equation,topic,level)
      values(p_request,p_user,p_equation,p_topic,p_level) returning * into question;
    insert into public.activity_events(request_id,user_id,kind,equation,topic,result,level,question_id)
      values(p_request,p_user,'challenge_view',p_equation,p_topic,'viewed',p_level,p_request);
  end if;
  return jsonb_build_object('question',to_jsonb(question),'progress',jsonb_build_object('level',progress.level,'correct',progress.correct));
end;
$$;

create function public.save_inequality_answer(p_user uuid,p_request uuid,p_question uuid,p_answer text,p_correct boolean,p_result text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare progress public.inequality_progress%rowtype; question public.challenge_questions%rowtype; existing public.activity_events%rowtype;
begin
  select * into progress from public.inequality_progress where user_id=p_user for update;
  if progress.user_id is null then raise exception 'Account missing'; end if;
  select * into question from public.challenge_questions where id=p_question and user_id=p_user for update;
  if question.id is null or question.topic not like 'Inequalities:%' then raise exception 'Challenge not found'; end if;
  select * into existing from public.activity_events where user_id=p_user and request_id=p_request;
  if existing.id is not null then
    if existing.kind<>'challenge_answer' or existing.question_id<>p_question then raise exception 'Request ID already used'; end if;
    return jsonb_build_object('level',progress.level,'correct',progress.correct);
  end if;
  if (select count(*) from public.activity_events where user_id=p_user and created_at>now()-interval '1 minute') >= 120 then raise exception 'Too many requests'; end if;
  insert into public.activity_events(request_id,user_id,kind,equation,topic,answer,correct,result,level,question_id)
    values(p_request,p_user,'challenge_answer',question.equation,question.topic,p_answer,p_correct,p_result,question.level,p_question);
  if p_correct and question.solved_at is null then
    update public.challenge_questions set solved_at=now() where id=p_question;
    if progress.level=question.level and progress.level<1000000 then
      update public.inequality_progress set level=level+1,correct=correct+1 where user_id=p_user returning * into progress;
    end if;
  end if;
  return jsonb_build_object('level',progress.level,'correct',progress.correct);
end;
$$;
revoke all on function public.create_inequality_challenge(uuid,uuid,text,text,integer), public.save_inequality_answer(uuid,uuid,uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.create_inequality_challenge(uuid,uuid,text,text,integer), public.save_inequality_answer(uuid,uuid,uuid,text,boolean,text) to service_role;

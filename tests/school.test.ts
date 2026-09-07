import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { schoolEmail, pageUrl } from '../lib/school.ts';
import { classifyQuestion, evaluateActivity } from '../lib/activity.ts';

void test('school emails reject suffix tricks and normalize valid school accounts', () => {
  assert.equal(schoolEmail(' KIsmail@AbaarsoSchool.org '), 'kismail@abaarsoschool.org');
  assert.equal(schoolEmail(' Student.Name@StudentAbaarso.org '), 'student.name@studentabaarso.org');
  assert.equal(schoolEmail('student+math@studentabaarso.org'), 'student+math@studentabaarso.org');
  for (const domain of ['abaarsoschool.org', 'studentabaarso.org']) {
    for (const email of [`a@${domain}.evil.com`, `a@evil${domain}`, `a@@${domain}`, `a@${domain}@`, `a..b@${domain}`, `a b@${domain}`, `@${domain}`, `a@sub.${domain}`]) assert.equal(schoolEmail(email), null, email);
  }
  assert.equal(schoolEmail('a@gmail.com'), null);
  assert.equal(pageUrl('/dashboard', '/algebra-with-khalid'), '/algebra-with-khalid/dashboard.html');
  assert.equal(pageUrl('/login'), '/login');
});
void test('question topics and practice results come from the submitted math', () => {
  for (const [equation, topic] of [['x + 2 = 5', 'One-step equations'], ['2x + 5 = 17', 'Two-step equations'], ['2(x + 1) = 8', 'Parentheses'], ['x/2 = 4', 'Fractions'], ['x + 2 = 2x + 3', 'Variables on both sides'], ['x = x + 1', 'No solution'], ['x = x', 'All real numbers'], ['x^2 = 4', 'Unsupported input']]) assert.equal(classifyQuestion(equation), topic, equation);
  assert.equal(evaluateActivity('practice', '2x + 5 = 17', '2x = 12').correct, true);
  assert.equal(evaluateActivity('practice', '2x + 5 = 17', 'x = 99').correct, false);
});

void test('database enforces school accounts, isolated records, teacher access and exactly-once progress', async () => {
  const db = new PGlite();
  const student = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  const teacher = '00000000-0000-4000-8000-000000000003';
  const pending = '00000000-0000-4000-8000-000000000004';
  const q1 = '00000000-0000-4000-8000-000000000011';
  const q2 = '00000000-0000-4000-8000-000000000012';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create role supabase_auth_admin;
      create schema auth; grant usage on schema public,auth to anon,authenticated,service_role,supabase_auth_admin;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));`);
    // The deployment already has a verified teacher. Pin that identity when
    // migrating; do not automatically grant a later signup the teacher role.
    await db.query('insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now())', [teacher, 'kismail@abaarsoschool.org']);
    const migrations = new URL('../supabase/migrations/', import.meta.url);
    for (const migration of (await readdir(migrations)).filter((file) => file.endsWith('.sql')).sort()) {
      await db.exec(await readFile(new URL(migration, migrations), 'utf8'));
    }
    for (const email of ['student@abaarsoschool.org', 'student@studentabaarso.org', 'STUDENT@STUDENTABAARSO.ORG', 'student+math@studentabaarso.org', 'student@gmail.com', 'student@studentabaarso.org.evil.com', 'student@evilstudentabaarso.org', 'student@@studentabaarso.org', 'student..name@studentabaarso.org', 'student@studentabaarso.org@']) {
      const allowed = !!schoolEmail(email);
      assert.equal((await db.query<{ allowed: boolean }>('select is_school_email($1) as allowed', [email])).rows[0].allowed, allowed, email);
      const hook = (await db.query<{ result: { error?: unknown } }>('select before_school_user_created($1::jsonb) as result', [JSON.stringify({ user: { email } })])).rows[0].result;
      assert.equal(!hook.error, allowed, email);
    }
    await assert.rejects(db.query('insert into auth.users values ($1,$2,now())', [student, 'student@example.com']), /school.org/);
    for (const [id, email] of [[student, 'student@studentabaarso.org'], [other, 'other@abaarsoschool.org'], [teacher, 'kismail@abaarsoschool.org']]) {
      await db.query('insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now()) on conflict(id) do nothing', [id, email]);
      await db.query('insert into auth.sessions values ($1,$1)', [id]);
    }
    await db.query('insert into auth.users(id,email) values ($1,$2)', [pending, 'pending@studentabaarso.org']);
    await assert.rejects(db.query('insert into auth.sessions values ($1,$1)', [pending]), /verified school/);
    async function as(role: string, id = '') { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec(`set role ${role}`); }
    await as('anon');
    await assert.rejects(db.query('select * from public.student_profiles'), /permission denied/);
    await assert.rejects(db.query('select public.teacher_dashboard()'), /permission denied/);
    await as('authenticated', student);
    assert.equal((await db.query('select * from student_profiles')).rows.length, 1);
    assert.equal((await db.query('select * from login_events')).rows.length, 1);
    await assert.rejects(db.query('select public.teacher_dashboard()'), /Teacher access/);
    await assert.rejects(db.query('select * from private.teachers'), /permission denied/);
    await assert.rejects(db.query('update student_profiles set level=99'), /permission denied/);
    await assert.rejects(db.query("insert into login_events(user_id,session_id) values ($1,$1)", [q1]), /permission denied/);
    await assert.rejects(db.query("select save_school_activity($1,$2,'solve','x=1','One-step equations')", [student, q1]), /permission denied/);
    await as('postgres');
    await db.query("update auth.users set raw_user_meta_data='{" + '"role":"teacher"' + "}' where id=$1", [student]);
    await as('authenticated', student);
    assert.equal((await db.query<{ teacher: boolean }>('select is_teacher() as teacher')).rows[0].teacher, false);
    await as('service_role');
    const create = () => db.query<{ result: { question: { equation: string }; progress: { level: number } } }>("select create_school_challenge($1,$2,'x + 2 = 5','Simple addition',1) as result", [student, q1]);
    await create(); await create();
    await db.query("select create_school_challenge($1,$2,'x + 4 = 5','Simple addition',1)", [student, q2]);
    assert.equal((await db.query('select * from challenge_questions')).rows.length, 2);
    assert.equal((await db.query('select * from activity_events')).rows.length, 2);
    await assert.rejects(db.query("select save_school_activity($1,$2,'challenge_answer','','','3',true,'correct',$3)", [other, teacher, q1]), /Challenge not found/);
    const attempt = '00000000-0000-4000-8000-000000000021';
    await db.query("select save_school_activity($1,$2,'challenge_answer','forged','forged','3',true,'correct',$3)", [student, attempt, q1]);
    await db.query("select save_school_activity($1,$2,'challenge_answer','','','3',true,'correct',$3)", [student, attempt, q1]);
    // Another already-open problem at level 1 cannot award level 2 a second time.
    await db.query("select save_school_activity($1,$2,'challenge_answer','','','1',true,'correct',$3)", [student, pending, q2]);
    const progress = (await db.query<{ level: number; correct: number }>('select level,correct from student_profiles where id=$1', [student])).rows[0];
    assert.deepEqual(progress, { level: 2, correct: 1 });
    assert.equal((await db.query<{ equation: string }>('select equation from activity_events where request_id=$1', [attempt])).rows[0].equation, 'x + 2 = 5');
    await as('authenticated', other);
    assert.equal((await db.query('select * from activity_events')).rows.length, 0);
    await as('authenticated', teacher);
    const report = (await db.query<{ report: { summary: { students: number; logins: number }; activities: unknown[] } }>('select teacher_dashboard() as report')).rows[0].report;
    assert.equal(report.summary.students, 2); assert.equal(report.summary.logins, 2); assert.equal(report.activities.length, 4);
    await as('authenticated', pending);
    assert.equal((await db.query('select * from student_profiles')).rows.length, 0);
    await as('postgres');
    // With confirmation disabled Auth auto-confirms password accounts. Even
    // such an account claiming the teacher email must not gain dashboard access.
    await db.query('update auth.users set email=$2 where id=$1', [teacher, 'teacher.old@abaarsoschool.org']);
    await db.query('update auth.users set email=$2 where id=$1', [other, 'kismail@abaarsoschool.org']);
    await as('authenticated', other);
    assert.equal((await db.query<{ teacher: boolean }>('select is_teacher() as teacher')).rows[0].teacher, false);
    await assert.rejects(db.query('select teacher_dashboard()'), /Teacher access/);
    assert.equal((await db.query('select * from student_profiles')).rows.length, 1);
    await as('postgres');
    await db.query('update auth.users set email=$2 where id=$1', [other, 'other@abaarsoschool.org']);
    await db.query('update auth.users set email=$2 where id=$1', [teacher, 'kismail@abaarsoschool.org']);
    await db.query('update auth.users set email_confirmed_at=null where id=$1', [teacher]);
    await as('authenticated', teacher);
    await assert.rejects(db.query('select teacher_dashboard()'), /Teacher access/);
  } finally { await db.close(); }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { checkInequalityAnswer, generateInequalityChallenge, parseIntervalAnswer } from '../lib/inequality-challenges.ts';
import { solveInequality } from '../lib/inequalities.ts';

await test('random inequality levels are solvable, varied and accept their interval answers', () => {
  let seed = 401;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (const level of [...Array.from({ length: 25 }, (_, i) => i + 1), 100, 1000, 1000000]) {
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const q = generateInequalityChallenge(level, '', random);
      assert.ok(q.equation.length <= 240);
      assert.equal(q.level, level);
      assert.equal(checkInequalityAnswer(q.equation, solveInequality(q.equation).interval).correct, true, q.equation);
      seen.add(q.equation);
    }
    assert.ok(seen.size > 1);
    const q = generateInequalityChallenge(level, '', () => .4);
    assert.notEqual(generateInequalityChallenge(level, q.equation, () => .4).equation, q.equation);
  }
  assert.match(generateInequalityChallenge(4).equation, /^-/);
  assert.match(generateInequalityChallenge(9).equation, /[<≤].+[<≤]/);
  assert.match(generateInequalityChallenge(10).equation, / or /);
});
await test('interval grading accepts equivalent fractions and normalized unions', () => {
  for (const a of ['(-inf, 3/2]', '(-infinity, 1.5]', '(-∞,6/4]', '(-inf,0) U [0,1.5]']) assert.equal(checkInequalityAnswer('2x<=3', a).correct, true, a);
  for (const a of ['(-inf,1.5)', '[1.5,inf)', '(1.5,inf)', '(-inf,3]']) assert.equal(checkInequalityAnswer('2x<=3', a).correct, false, a);
  for (const a of ['', 'x<2', '[-inf,2]', '(2,-inf)', '(inf,2]', '(3,2)', '(1/0,inf)', '(0,inf]', '(a,2)']) assert.equal(checkInequalityAnswer('x<2', a).valid, false, a);
  assert.equal(parseIntervalAnswer('[3,inf) union (-inf,-2)'), '(-∞, -2) ∪ [3, ∞)');
  assert.equal(parseIntervalAnswer('(-inf,0] U (0,inf)'), '(-∞, ∞)');
  assert.equal(checkInequalityAnswer('x<x', '∅').correct, true);
  assert.equal(checkInequalityAnswer('x<=x', '(-inf,inf)').correct, true);
});
await test('inequality progress is isolated, protected, logged, and awarded once', async () => {
  const db = new PGlite();
  const student='00000000-0000-4000-8000-000000000001', other='00000000-0000-4000-8000-000000000002';
  const q='00000000-0000-4000-8000-000000000011', stale='00000000-0000-4000-8000-000000000012';
  const a='00000000-0000-4000-8000-000000000021', b='00000000-0000-4000-8000-000000000022';
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create role supabase_auth_admin;
      create schema auth; grant usage on schema public,auth to anon,authenticated,service_role,supabase_auth_admin;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id));`);
    const migrations = new URL('../supabase/migrations/', import.meta.url);
    for (const file of (await readdir(migrations)).filter(f => f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,migrations),'utf8'));
    for (const [id,email] of [[student,'one@studentabaarso.org'],[other,'two@abaarsoschool.org']]) {
      await db.query('insert into auth.users values($1,$2,now())',[id,email]);
      await db.query('insert into auth.sessions values($1,$1)',[id]);
    }
    await db.query('update student_profiles set level=8,correct=7 where id=$1',[student]);
    await db.exec('set role service_role');
    const create = (id: string) => db.query("select create_inequality_challenge($1,$2,'x+2<5','Inequalities: One-step bounds',1)",[student,id]);
    await create(q); await create(q); await create(stale);
    assert.equal((await db.query('select * from activity_events')).rows.length,2);
    await db.query("select save_inequality_answer($1,$2,$3,'(-inf,3)',true,'correct')",[student,a,q]);
    await db.query("select save_inequality_answer($1,$2,$3,'(-inf,3)',true,'correct')",[student,a,q]);
    await db.query("select save_inequality_answer($1,$2,$3,'(-inf,3)',true,'correct')",[student,b,stale]);
    assert.deepEqual((await db.query('select level,correct from inequality_progress where user_id=$1',[student])).rows[0],{level:2,correct:1});
    assert.deepEqual((await db.query('select level,correct from student_profiles where id=$1',[student])).rows[0],{level:8,correct:7});
    assert.equal((await db.query('select * from activity_events')).rows.length,4);
    await assert.rejects(db.query("select save_inequality_answer($1,$2,$3,'(-inf,3)',true,'correct')",[student,q,q]),/Request ID/);
    await assert.rejects(db.query("select save_inequality_answer($1,$2,$3,'(-inf,3)',true,'correct')",[other,b,q]),/Account missing|Challenge not found/);
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from inequality_progress')).rows.length,0);
    await assert.rejects(create(q),/permission denied/);
    await assert.rejects(db.query('update inequality_progress set level=100'),/permission denied/);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from inequality_progress'),/permission denied/);
  } finally { await db.close(); }
});

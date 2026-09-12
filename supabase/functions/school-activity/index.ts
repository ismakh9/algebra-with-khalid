import { createClient } from 'npm:@supabase/supabase-js@2.115.0';
import { generateInequalityChallenge, checkInequalityAnswer } from '../../../lib/inequality-challenges.ts';
import { schoolEmail } from '../../../lib/school.ts';
import { evaluateActivity } from '../../../lib/activity.ts';
import { generateChallenge, checkChallengeAnswer, type ChallengeProblem } from '../../../lib/challenges.ts';
import { solveEquation } from '../../../lib/solver.ts';

const allowedOrigins = new Set(['https://ismakh9.github.io', 'http://localhost:3000', 'http://127.0.0.1:3000']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const problemFrom = (q: { equation: string; topic: string; level: number }): ChallengeProblem => ({ equation: q.equation, topic: q.topic, level: q.level, solution: solveEquation(q.equation) });

Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
  if (origin && allowedOrigins.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'authorization, x-client-info, apikey, content-type';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  }
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !allowedOrigins.has(origin)) return reply({ error: 'Origin not allowed.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply({ error: 'Use POST.' }, 405);
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply({ error: 'Sign in with your school account.' }, 401);
  try {
    // Validate with Auth on every call; never trust decoded claims or client IDs.
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user || !user.email_confirmed_at || !schoolEmail(user.email ?? '')) return reply({ error: 'A verified school account is required.' }, 401);
    if (Number(request.headers.get('content-length') || 0) > 4096) return reply({ error: 'Request too large.' }, 413);
    const text = await request.text();
    if (text.length > 4096) return reply({ error: 'Request too large.' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { return reply({ error: 'Invalid request.' }, 400); }
    if (!body || typeof body !== 'object' || typeof body.requestId !== 'string' || !uuid.test(body.requestId)) return reply({ error: 'Invalid request ID.' }, 400);
    const { data: profile, error: profileError } = await admin.from('student_profiles').select('level,correct').eq('id', user.id).single();
    if (profileError || !profile) return reply({ error: 'Your account is not ready. Please sign out and sign in again.' }, 409);
    if (body.action === 'record') {
      if (!['solve', 'practice'].includes(body.kind) || typeof body.equation !== 'string' || (body.answer !== undefined && typeof body.answer !== 'string')) return reply({ error: 'Invalid activity.' }, 400);
      let graded;
      try { graded = evaluateActivity(body.kind, body.equation, body.answer); } catch { return reply({ error: 'Enter an equation and answer of up to 240 characters.' }, 400); }
      const { error } = await admin.rpc('save_school_activity', { p_user: user.id, p_request: body.requestId, p_kind: body.kind, p_equation: body.equation, p_topic: graded.topic, p_answer: body.answer ?? null, p_correct: graded.correct, p_result: graded.result });
      if (error) throw error;
      return reply({ saved: true });
    }
    if (body.action === 'inequality_new') {
      const { data: progress, error: progressError } = await admin.from('inequality_progress').select('level,correct').eq('user_id', user.id).maybeSingle();
      if (progressError) throw progressError;
      let previous = '';
      if (body.previousId !== undefined) {
        if (typeof body.previousId !== 'string' || !uuid.test(body.previousId)) return reply({ error: 'Invalid challenge.' }, 400);
        const { data } = await admin.from('challenge_questions').select('equation').eq('user_id', user.id).eq('id', body.previousId).maybeSingle();
        previous = data?.equation ?? '';
      }
      const generated = generateInequalityChallenge(progress?.level ?? 1, previous);
      const { data, error } = await admin.rpc('create_inequality_challenge', { p_user: user.id, p_request: body.requestId, p_equation: generated.equation, p_topic: generated.topic, p_level: generated.level });
      if (error) throw error;
      return reply({ id: data.question.id, problem: { equation: data.question.equation, topic: data.question.topic, level: data.question.level }, progress: data.progress });
    }
    if (body.action === 'inequality_answer') {
      if (typeof body.questionId !== 'string' || !uuid.test(body.questionId) || typeof body.answer !== 'string' || body.answer.length > 240) return reply({ error: 'Invalid answer.' }, 400);
      const { data: question, error: questionError } = await admin.from('challenge_questions').select('equation,topic,level').eq('id', body.questionId).eq('user_id', user.id).maybeSingle();
      if (questionError) throw questionError;
      if (!question || !question.topic.startsWith('Inequalities:')) return reply({ error: 'Challenge not found for your account.' }, 404);
      const { data: existing, error: existingError } = await admin.from('activity_events').select('answer,question_id,kind').eq('user_id', user.id).eq('request_id', body.requestId).maybeSingle();
      if (existingError) throw existingError;
      if (existing && (existing.kind !== 'challenge_answer' || existing.question_id !== body.questionId)) return reply({ error: 'Request ID already used.' }, 409);
      const answer = existing?.answer ?? body.answer;
      const result = checkInequalityAnswer(question.equation, answer);
      const { data: progress, error } = await admin.rpc('save_inequality_answer', { p_user: user.id, p_request: body.requestId, p_question: body.questionId, p_answer: answer, p_correct: result.correct, p_result: result.correct ? 'correct' : result.valid ? 'try_again' : 'invalid' });
      if (error) throw error;
      return reply({ result, progress });
    }
    if (body.action === 'challenge_new') {
      let previous = '';
      if (body.previousId !== undefined) {
        if (typeof body.previousId !== 'string' || !uuid.test(body.previousId)) return reply({ error: 'Invalid challenge.' }, 400);
        const { data } = await admin.from('challenge_questions').select('equation').eq('user_id', user.id).eq('id', body.previousId).maybeSingle();
        previous = data?.equation ?? '';
      }
      const generated = generateChallenge(profile.level, previous);
      const { data, error } = await admin.rpc('create_school_challenge', { p_user: user.id, p_request: body.requestId, p_equation: generated.equation, p_topic: generated.topic, p_level: profile.level });
      if (error) throw error;
      return reply({ id: data.question.id, problem: problemFrom(data.question), progress: data.progress });
    }
    if (body.action === 'challenge_answer') {
      if (typeof body.questionId !== 'string' || !uuid.test(body.questionId) || typeof body.answer !== 'string' || body.answer.length > 100) return reply({ error: 'Invalid answer.' }, 400);
      const { data: question, error: questionError } = await admin.from('challenge_questions').select('equation,topic,level').eq('id', body.questionId).eq('user_id', user.id).maybeSingle();
      if (questionError) throw questionError;
      if (!question) return reply({ error: 'Challenge not found for your account.' }, 404);
      // Replaying an HTTP request returns its original grade, even if its body is changed.
      const { data: existing } = await admin.from('activity_events').select('answer,question_id,kind').eq('user_id', user.id).eq('request_id', body.requestId).maybeSingle();
      if (existing && (existing.kind !== 'challenge_answer' || existing.question_id !== body.questionId)) return reply({ error: 'Request ID already used.' }, 409);
      const answer = existing?.answer ?? body.answer;
      const result = checkChallengeAnswer(problemFrom(question), answer);
      const { data: progress, error } = await admin.rpc('save_school_activity', { p_user: user.id, p_request: body.requestId, p_kind: 'challenge_answer', p_equation: question.equation, p_topic: question.topic, p_answer: answer, p_correct: result.correct, p_result: result.correct ? 'correct' : result.valid ? 'try_again' : 'invalid', p_question: body.questionId });
      if (error) throw error;
      return reply({ result, progress });
    }
    return reply({ error: 'Unknown action.' }, 400);
  } catch (error) {
    const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
    if (message.includes('Too many requests')) return reply({ error: 'Too many requests. Please wait a minute.' }, 429);
    if (message.includes('Level changed')) return reply({ error: 'Your level changed in another tab. Try loading the next challenge again.' }, 409);
    return reply({ error: 'Could not save your activity. Please try again.' }, 500);
  }
});

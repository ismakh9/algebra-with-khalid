'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Lightbulb, Shuffle, Trophy } from 'lucide-react';
import { schoolApi } from '@/lib/backend';
import { type AnswerResult, type ChallengeProgress } from '@/lib/challenges';
import { inequalityTopic } from '@/lib/inequality-challenges';
import { solveInequality } from '@/lib/inequalities';
import { NumberLine } from '@/app/inequalities/inequalities';
import '../inequalities/inequalities.css';

type Question = { equation: string; topic: string; level: number };
type ChallengeData = { id: string; problem: Question; progress: ChallengeProgress };
export default function InequalityPractice() {
  const [data, setData] = useState<ChallengeData | null>(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [hint, setHint] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const initial = useRef('');
  const pendingNew = useRef('');
  const pendingAnswer = useRef<{ id: string; answer: string; question: string } | null>(null);
  const flight = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const completed = feedback?.correct === true;
  useEffect(() => {
    let active = true;
    initial.current ||= crypto.randomUUID();
    schoolApi<ChallengeData>({ action: 'inequality_new', requestId: initial.current })
      .then(result => { if (active) setData(result); })
      .catch(() => { if (active) setError('Could not load an inequality. Please try again.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);
  async function next() {
    if (busy || flight.current) return;
    flight.current = true; setBusy(true); setError('');
    pendingNew.current ||= data ? crypto.randomUUID() : initial.current;
    try {
      const result = await schoolApi<ChallengeData>({ action: 'inequality_new', requestId: pendingNew.current, previousId: data?.id });
      setData(result); setAnswer(''); setFeedback(null); setHint(false);
      pendingNew.current = ''; pendingAnswer.current = null;
      requestAnimationFrame(() => input.current?.focus());
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Please try again.'); }
    finally { flight.current = false; setBusy(false); }
  }
  async function submit() {
    if (busy || flight.current || !data || completed) return;
    flight.current = true; setBusy(true); setError('');
    if (!pendingAnswer.current || pendingAnswer.current.answer !== answer || pendingAnswer.current.question !== data.id) pendingAnswer.current = { id: crypto.randomUUID(), answer, question: data.id };
    try {
      const result = await schoolApi<{ result: AnswerResult; progress: ChallengeProgress }>({ action: 'inequality_answer', requestId: pendingAnswer.current.id, questionId: data.id, answer });
      setFeedback(result.result); setData({ ...data, progress: result.progress }); pendingAnswer.current = null;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not check your answer. Please try again.'); }
    finally { flight.current = false; setBusy(false); }
  }
  const solution = completed && data ? solveInequality(data.problem.equation) : null;
  return <div className="challenge-layout inequality-practice">
    <section className="challenge-column" aria-label="Inequality challenge">
      <div className="challenge-section-heading"><h2><Shuffle size={18} />Your next inequality</h2><span>Randomly generated</span></div>
      <div className={`challenge-question-card ${completed ? 'is-complete' : ''}`}>
        {error && <div className="school-error" role="alert">{error}{!data && <button type="button" className="text-button" disabled={busy} onClick={() => { void next(); }}>Try again</button>}</div>}
        {data ? <>
          <div className="challenge-card-top"><span className="level-badge">LEVEL {data.problem.level}</span><span>{inequalityTopic(data.problem.level)}</span></div>
          <div className="challenge-equation"><span className="label">FIND ALL VALUES OF x</span><p className="inequality-challenge-expression">{data.problem.equation}</p></div>
          <form className="challenge-answer-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
            <label htmlFor="inequality-challenge-answer">Your answer in interval notation</label>
            <div className="challenge-answer-row"><input id="inequality-challenge-answer" ref={input} value={answer} onChange={event => { setAnswer(event.target.value); setFeedback(null); }} disabled={busy || completed} placeholder="e.g. (-inf, 3]" maxLength={240} autoComplete="off" autoCapitalize="off" spellCheck={false} aria-describedby="inequality-answer-format" /><button type="submit" className="primary-button" disabled={busy || completed}>{busy ? 'Checking…' : completed ? 'Correct' : 'Check answer'}<ArrowRight size={17} /></button></div>
            <p id="inequality-answer-format">Use [ ] to include an endpoint and ( ) to exclude it. Type inf for ∞ and U for a union. Example: (-inf, -2) U [3, inf).</p>
          </form>
          {feedback && <output className={`challenge-feedback ${completed ? 'correct' : 'try-again'}`} aria-live="polite"><div><strong>{completed ? `Level ${data.progress.level} unlocked!` : feedback.valid ? 'Give it another try.' : 'Check your interval notation.'}</strong><p>{feedback.message}</p></div></output>}
          {solution && <div className="inequality-challenge-solution"><h3>Solution: {solution.interval}</h3><NumberLine solution={solution} /></div>}
          {completed ? <div className="next-challenge"><button type="button" className="primary-button" disabled={busy} onClick={() => { void next(); }}>Next inequality<ArrowRight size={17} /></button></div> : <div className="challenge-tools"><button type="button" className="text-button" onClick={() => setHint(!hint)} aria-expanded={hint} aria-controls="inequality-practice-hint"><Lightbulb size={15} />{hint ? 'Hide hint' : 'A little hint'}</button><button type="button" className="text-button" disabled={busy} onClick={() => { void next(); }}><Shuffle size={15} />Different problem, same level</button></div>}
          {hint && !completed && <div className="challenge-hint" id="inequality-practice-hint"><strong>Keep track of the direction.</strong><p>Simplify each side first. If you divide by a negative number, reverse the inequality sign. Use a square bracket only when the endpoint is included.</p></div>}
        </> : <div className="challenge-loading">{busy ? 'Finding your next inequality…' : 'Your challenge is ready to retry.'}</div>}
      </div>
    </section>
    <aside className="challenge-sidebar"><div className="challenge-progress-card"><span className="mini-icon"><Trophy size={22} /></span><h3>Your inequality progress</h3><div className="challenge-stats"><div><strong>{data?.progress.correct ?? 0}</strong><span>solved</span></div><div><strong>{data?.progress.level ?? 1}</strong><span>level unlocked</span></div></div><p>Every correct answer unlocks a harder inequality. Your equation level is saved separately.</p></div><p className="challenge-storage-note">Both challenge tracks are saved to your school account, across devices.</p></aside>
  </div>;
}

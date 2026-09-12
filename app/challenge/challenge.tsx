'use client';

import { useEffect, useRef, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import InequalityPractice from './inequality-practice';
import './challenge-modes.css';
import { DocumentLink } from '@/components/document-link';
import { AccountMenu } from '@/components/school-auth';
import { schoolApi } from '@/lib/backend';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  CircleArrowUp,
  GraduationCap,
  Lightbulb,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { MathText } from '@/components/math';
import { Progress } from '@/components/ui/progress';
import {
  levelTopic,
  type AnswerResult,
  type ChallengeProblem,
  type ChallengeProgress,
} from '@/lib/challenges';

type SchoolChallenge = { id: string; problem: ChallengeProblem; progress: ChallengeProgress };
type SchoolAnswer = { result: AnswerResult; progress: ChallengeProgress };
const LADDER = [
  {
    level: 1,
    label: 'Build the foundations',
    description: 'One operation at a time',
  },
  {
    level: 4,
    label: 'Connect the steps',
    description: 'Two steps and negative numbers',
  },
  {
    level: 6,
    label: 'Open things up',
    description: 'Parentheses and both sides',
  },
  {
    level: 8,
    label: 'Find your balance',
    description: 'Fractions and nested expressions',
  },
  {
    level: 11,
    label: 'Keep stretching',
    description: 'Advanced equations, bigger numbers',
  },
];

export default function Challenge() {
  const [inequalitiesOpened, setInequalitiesOpened] = useState(false);
  const [progress, setProgress] = useState<ChallengeProgress>({
    level: 1,
    correct: 0,
  });
  const [problem, setProblem] = useState<ChallengeProblem | null>(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [problemId, setProblemId] = useState('');
  const initialRequest = useRef('');
  const pendingQuestion = useRef('');
  const pendingAnswer = useRef<{ id: string; answer: string; question: string } | null>(null);
  const inFlight = useRef(false);
  const answerRef = useRef<HTMLInputElement>(null);
  const completed = feedback?.correct === true;

  useEffect(() => {
    let active = true;
    initialRequest.current ||= crypto.randomUUID();
    // oxlint-disable-next-line react/react-compiler -- Load account-specific progress from the server after hydration.
    setBusy(true);
    schoolApi<SchoolChallenge>({ action: 'challenge_new', requestId: initialRequest.current })
      .then(data => { if (active) { setProblem(data.problem); setProblemId(data.id); setProgress(data.progress); } })
      .catch(() => { if (active) setError('Could not load your challenge. Check your connection and try again.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function nextProblem() {
    if (busy || inFlight.current) return;
    inFlight.current = true;
    pendingQuestion.current ||= !problem ? initialRequest.current : crypto.randomUUID();
    setBusy(true); setError('');
    try {
      const data = await schoolApi<SchoolChallenge>({ action: 'challenge_new', requestId: pendingQuestion.current, previousId: problemId || undefined });
      setProblem(data.problem); setProblemId(data.id); setProgress(data.progress);
      setAnswer(''); setFeedback(null); setShowHint(false);
      pendingQuestion.current = ''; pendingAnswer.current = null;
      requestAnimationFrame(() => answerRef.current?.focus());
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load your challenge. Please try again.'); }
    finally { setBusy(false); inFlight.current = false; }
  }
  async function submitAnswer() {
    if (!problem || completed || busy || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError('');
    if (!pendingAnswer.current || pendingAnswer.current.answer !== answer || pendingAnswer.current.question !== problemId)
      pendingAnswer.current = { id: crypto.randomUUID(), answer, question: problemId };
    try {
      const data = await schoolApi<SchoolAnswer>({ action: 'challenge_answer', requestId: pendingAnswer.current.id, questionId: problemId, answer });
      setFeedback(data.result); setProgress(data.progress); pendingAnswer.current = null;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your answer. Please try again.'); }
    finally { setBusy(false); inFlight.current = false; }
  }
  const activeLevel = problem?.level || progress.level;
  const activeStage = LADDER.reduce(
    (latest, stage, i) => (activeLevel >= stage.level ? i : latest),
    0,
  );

  return (
    <div className="site-shell">
      <header className="site-header challenge-header">
        <DocumentLink
          href="/"
          className="brand"
          aria-label="Algebra with Khalid home"
        >
          <span className="brand-mark" aria-hidden="true">
            x<span>·</span>
          </span>
          <span className="brand-name">
            Algebra<span>with Khalid</span>
          </span>
        </DocumentLink>
        <nav aria-label="Main navigation">
          <DocumentLink href="/" className="back-to-solver">
            <ArrowLeft size={15} />
            Back to solver
          </DocumentLink>
          <DocumentLink
            href="/challenge"
            className="challenge-link active"
            aria-current="page"
          >
            <Sparkles size={15} />
            Challenge
          </DocumentLink>
        </nav>
      </header>
      <AccountMenu />
      <main className="challenge-main">
        <section className="hero challenge-hero">
          <div className="eyebrow">
            <Sparkles size={13} />A LITTLE PRACTICE. A LITTLE PROGRESS.
          </div>
          <h1>
            A little better.
            <br />
            <span>With every challenge.</span>
          </h1>
          <p>A fresh challenge. A new level. Your own pace.</p>
        </section>
        <Tabs defaultValue="equations" className="challenge-modes" onValueChange={value => { if (value === 'inequalities') setInequalitiesOpened(true); }}>
          <TabsList aria-label="Choose challenge type" className="challenge-mode-buttons">
            <TabsTrigger value="equations">Equations</TabsTrigger>
            <TabsTrigger value="inequalities">Inequalities</TabsTrigger>
          </TabsList>
          <TabsContent value="equations" keepMounted>
        <div className="challenge-layout">
          <section
            className="challenge-column"
            aria-labelledby="challenge-heading"
          >
            <div className="challenge-section-heading">
              <h2 id="challenge-heading">
                <Shuffle size={18} />
                Your next challenge
              </h2>
              <span>Randomly generated</span>
            </div>
            <div
              className={`challenge-question-card ${completed ? 'is-complete' : ''}`}
            >
              <div className="challenge-card-top">
                <span className="level-badge">
                  <CircleArrowUp size={14} />
                  LEVEL {activeLevel}
                </span>
                <span>{problem?.topic || levelTopic(progress.level)}</span>
              </div>
              {error && <div className="school-error" role="alert">{error}{!problem && <button className="text-button" disabled={busy} onClick={() => { void nextProblem(); }}>Try again</button>}</div>}
              {problem ? (
                <>
                  <div className="challenge-equation" key={problem.equation}>
                    <span className="label">SOLVE FOR x</span>
                    <MathText value={problem.equation} />
                  </div>
                  <form
                    className="challenge-answer-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitAnswer();
                    }}
                  >
                    <label htmlFor="challenge-answer">Your answer</label>
                    <div className="challenge-answer-row">
                      <span className="answer-prefix" aria-hidden="true">
                        x =
                      </span>
                      <input
                        id="challenge-answer"
                        ref={answerRef}
                        value={answer}
                        onChange={(event) => {
                          setAnswer(event.target.value);
                          setFeedback(null);
                        }}
                        placeholder="Enter a number or fraction"
                        disabled={completed || busy}
                        autoComplete="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        maxLength={100}
                        enterKeyHint="done"
                        aria-describedby={
                          feedback ? 'challenge-feedback' : 'answer-format'
                        }
                      />
                      <button
                        className="primary-button"
                        type="submit"
                        disabled={completed || busy}
                      >
                        {completed ? (
                          <>
                            <Check size={17} />
                            Correct
                          </>
                        ) : (
                          <>
                            {busy ? 'Saving…' : 'Check answer'}
                            <ArrowRight size={17} />
                          </>
                        )}
                      </button>
                    </div>
                    <p id="answer-format">
                      Fractions like 3/2 and exact decimals are welcome.
                    </p>
                  </form>
                  {feedback && (
                    <output
                      id="challenge-feedback"
                      className={`challenge-feedback ${completed ? 'correct' : 'try-again'}`}
                      aria-live="polite"
                    >
                      <span>
                        {completed ? (
                          <CheckCheck size={21} />
                        ) : (
                          <Lightbulb size={20} />
                        )}
                      </span>
                      <div>
                        <strong>
                          {completed
                            ? `Level ${progress.level} unlocked.`
                            : feedback.valid
                              ? 'You’re still in the game.'
                              : 'Let’s check that format.'}
                        </strong>
                        <p>
                          {completed
                            ? `Nice work. Up next: ${levelTopic(progress.level).toLowerCase()}.`
                            : feedback.message}
                        </p>
                      </div>
                    </output>
                  )}
                  {completed ? (
                    <div className="next-challenge">
                      <button className="primary-button" disabled={busy} onClick={() => { void nextProblem(); }}>
                        Next challenge
                        <ArrowRight size={17} />
                      </button>
                      <span>One correct answer. One level higher.</span>
                    </div>
                  ) : (
                    <div className="challenge-tools">
                      <button
                        className="text-button"
                        onClick={() => setShowHint((value) => !value)}
                        aria-expanded={showHint}
                        aria-controls="challenge-hint"
                      >
                        <Lightbulb size={15} />
                        {showHint ? 'Hide hint' : 'A little hint'}
                      </button>
                      <button className="text-button" disabled={busy} onClick={() => { void nextProblem(); }}>
                        <Shuffle size={15} />
                        Different problem, same level
                      </button>
                    </div>
                  )}
                  {showHint && !completed && (
                    <div id="challenge-hint" className="challenge-hint">
                      <strong>Think about the first move.</strong>
                      <p>
                        {problem.solution.steps[0].title}.{' '}
                        {problem.solution.steps[0].explanation}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="challenge-loading">
                  <RotateCcw size={22} />
                  <p>Finding your next equation…</p>
                </div>
              )}
            </div>
            <div className="challenge-reassurance">
              <GraduationCap size={18} />
              <p>
                Every correct answer moves you up a level. Take another try
                whenever you need it.
              </p>
            </div>
          </section>
          <aside className="challenge-sidebar">
            <div className="challenge-progress-card">
              <span className="mini-icon">
                <Trophy size={22} />
              </span>
              <h3>Your progress, earned.</h3>
              <div className="challenge-stats">
                <div>
                  <strong>{progress.correct}</strong>
                  <span>solved</span>
                </div>
                <div>
                  <strong>{progress.level}</strong>
                  <span>level unlocked</span>
                </div>
              </div>
              <div className="path-progress-label">
                <span>
                  {progress.level >= 11
                    ? 'Advanced path unlocked'
                    : 'On the way to mastery'}
                </span>
                <span>{Math.min(progress.level, 11)}/11</span>
              </div>
              <Progress
                value={Math.min(progress.level, 11)}
                max={11}
                aria-label="Progress to advanced linear equations"
                className="challenge-progress"
              />
              <p>
                {progress.level >= 11
                  ? 'Keep going. Each new level brings larger numbers and more demanding equations.'
                  : 'From simple addition to fractions and parentheses. One win at a time.'}
              </p>
            </div>
            <div className="challenge-ladder">
              <h3>A little further each time</h3>
              <ol>
                {LADDER.map((stage, i) => (
                  <li
                    key={stage.level}
                    className={
                      i === activeStage
                        ? 'current-stage'
                        : i < activeStage
                          ? 'passed-stage'
                          : ''
                    }
                  >
                    <span className="ladder-dot">
                      {i < activeStage ? <Check size={12} /> : i + 1}
                    </span>
                    <div>
                      <h4>{stage.label}</h4>
                      <p>{stage.description}</p>
                    </div>
                    {i === activeStage && <ChevronRight size={14} />}
                  </li>
                ))}
              </ol>
            </div>
            <p className="challenge-storage-note">
              Your progress is saved to your school account, across devices.
            </p>
          </aside>
        </div>
          </TabsContent>
          <TabsContent value="inequalities" keepMounted>{inequalitiesOpened && <InequalityPractice />}</TabsContent>
        </Tabs>
        <div className="bottom-note">
          <span className="status-dot" />
          Progress comes from practice, not perfection.
        </div>
      </main>
      <footer>
        <DocumentLink href="/" className="footer-brand">
          Algebra with Khalid<span>Make the math make sense.</span>
        </DocumentLink>
        <span>Your school account. Your next step.</span>
      </footer>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { DocumentLink } from '@/components/document-link';
import { AccountMenu, useSchoolAuth } from '@/components/school-auth';
import { useActivityRecorder } from '@/components/school-activity';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock3,
  GraduationCap,
  Lightbulb,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { MathText } from '@/components/math';
import {
  solveEquation,
  checkStudentStep,
  normalizeInput,
  type Solution,
} from '@/lib/solver';

const DEFAULT = '3(2x − 5) + 4 = 19';
const EXAMPLES = [
  { equation: '2x + 5 = 17', label: 'Start simple', category: 'Two steps' },
  {
    equation: '4(x - 3) = 20',
    label: 'Open things up',
    category: 'Parentheses',
  },
  {
    equation: '(x + 2)/5 = 3',
    label: 'A fresh fraction',
    category: 'Fractions',
  },
  {
    equation: '3x + 5 = 2x + 12',
    label: 'Meet in the middle',
    category: 'Both sides',
  },
  {
    equation: '-2x + 9 = 21',
    label: 'A different direction',
    category: 'Negative numbers',
  },
  {
    equation: '0.5x + 1.5 = 4',
    label: 'A little decimal',
    category: 'Decimals',
  },
];
const PRACTICE = [
  '3(x + 2) = 18',
  '2x + 7 = 19',
  '4(x - 3) = 20',
  '3x + 5 = 2x + 12',
  '(x + 2)/5 = 3',
  '-2x + 9 = 21',
];
const STORAGE_KEY = 'solvex:history:v1';
type Level = 'quick' | 'guided' | 'teach';
type HistoryItem = { equation: string; answer: string; at: number };

export default function Home() {
  const { account } = useSchoolAuth();
  const storageKey = `${STORAGE_KEY}:${account?.id}`;
  const { record, notice } = useActivityRecorder();
  const [input, setInput] = useState(DEFAULT);
  const [solution, setSolution] = useState<Solution | null>(() =>
    solveEquation(DEFAULT),
  );
  const [error, setError] = useState('');
  const [level, setLevel] = useState<Level>('guided');
  const [revealed, setRevealed] = useState(99);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [verified, setVerified] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyAvailable, setHistoryAvailable] = useState(true);
  const [modal, setModal] = useState<'about' | 'examples' | 'practice' | null>(
    null,
  );
  const [replay, setReplay] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [studentStep, setStudentStep] = useState('');
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    message: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HistoryItem[]>([]);
  const resultRef = useRef<HTMLElement>(null);
  const [solvedInput, setSolvedInput] = useState(normalizeInput(DEFAULT));
  const dirty = normalizeInput(input) !== solvedInput;

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(storageKey) || '[]',
      );
      if (Array.isArray(stored)) {
        const items = stored
          .filter(
            (item): item is HistoryItem =>
              !!item &&
              typeof item.equation === 'string' &&
              item.equation.length <= 240 &&
              typeof item.answer === 'string' &&
              typeof item.at === 'number',
          )
          .slice(0, 8);
        historyRef.current = items;
        // oxlint-disable-next-line react/react-compiler -- Hydrate browser-only storage after server rendering.
        setHistory(items);
      }
    } catch {
      setHistoryAvailable(false);
    }
  }, [storageKey]);

  const runSolve = useCallback(
    (equation: string, options?: { all?: boolean; scroll?: boolean }) => {
      setInput(equation);
      record('solve', equation);
      try {
        const next = solveEquation(equation);
        setSolution(next);
        setError('');
        setRevealed(options?.all ? next.steps.length : 1);
        setExpanded([]);
        setVerified(false);
        setReplay((v) => v + 1);
        setSolvedInput(normalizeInput(equation));
        const items = [
          { equation, answer: next.answer, at: Date.now() },
          ...historyRef.current.filter(
            (item) =>
              normalizeInput(item.equation).replace(/\s/g, '') !==
              normalizeInput(equation).replace(/\s/g, ''),
          ),
        ].slice(0, 8);
        historyRef.current = items;
        setHistory(items);
        try {
          localStorage.setItem(storageKey, JSON.stringify(items));
        } catch {
          setHistoryAvailable(false);
        }
        setAnnouncement(
          `Equation solved. ${next.steps.length} steps. ${options?.all ? 'All steps are shown.' : 'The first step is shown.'}`,
        );
        if (options?.scroll)
          requestAnimationFrame(() =>
            resultRef.current?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            }),
          );
        return {
          ok: true,
          equation: next.input,
          steps: next.steps.length,
          answer: next.answer,
        };
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : 'Something went wrong. Check your equation and try again.';
        setError(message);
        setSolution(null);
        setAnnouncement(message);
        return { ok: false, error: message };
      }
    },
    [record, storageKey],
  );

  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'solve_linear_equation',
            title: 'Solve an equation',
            description:
              'Solve one-variable linear equations, show the full explanation on this page, and save the equation to device-local history.',
            inputSchema: {
              type: 'object',
              properties: { equation: { type: 'string', maxLength: 240 } },
              required: ['equation'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: true },
            execute(data: unknown) {
              if (
                !data ||
                typeof data !== 'object' ||
                !('equation' in data) ||
                typeof data.equation !== 'string'
              )
                return { ok: false, error: 'Provide an equation string.' };
              let result: ReturnType<typeof runSolve> | undefined;
              flushSync(() => {
                result = runSolve(data.equation as string, { all: true });
              });
              return result;
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* WebMCP is an optional enhancement in supporting browsers. */
    }
    return () => lifecycle.abort();
  }, [runSolve]);

  function chooseExample(equation: string) {
    setModal(null);
    runSolve(equation, { scroll: true });
  }
  function clearHistory() {
    historyRef.current = [];
    setHistory([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      setHistoryAvailable(false);
    }
  }
  function openPractice() {
    setStudentStep('');
    setFeedback(null);
    setModal('practice');
  }
  function nextPractice() {
    setPracticeIndex((i) => (i + 1) % PRACTICE.length);
    setStudentStep('');
    setFeedback(null);
  }
  function renderSolution(detail: Level) {
    if (!solution)
      return (
        <div className="empty-solution">
          <BookOpen size={25} />
          <h3>A fresh starting point.</h3>
          <p>
            Enter a linear equation above and we’ll take it one step at a time.
          </p>
          <button
            className="text-button"
            onClick={() => chooseExample(DEFAULT)}
          >
            Try a worked example
            <ArrowRight size={15} />
          </button>
        </div>
      );
    const count =
      detail === 'quick'
        ? solution.steps.length
        : Math.min(revealed, solution.steps.length);
    const complete = count === solution.steps.length;
    return (
      <div className={`solution-card ${dirty ? 'is-outdated' : ''}`}>
        <div className="solution-intro">
          <div className="starting-label">
            <span className="label">YOUR STARTING POINT</span>
            <button
              className="icon-button"
              title="Replay solution one step at a time"
              aria-label="Replay solution one step at a time"
              onClick={() => {
                setRevealed(1);
                setLevel('guided');
                setReplay((v) => v + 1);
                setVerified(false);
              }}
            >
              <RotateCcw size={14} />
            </button>
          </div>
          <MathText value={solution.input} className="original-equation" />
          <div className="solution-meta">
            <span>Linear equation</span>
            <span>
              {solution.steps.length}{' '}
              {solution.steps.length === 1 ? 'step' : 'steps'} to clarity
            </span>
            <span className="change-key">
              <i />
              What changed
            </span>
          </div>
        </div>
        {dirty && (
          <div className="dirty-note">
            Equation edited. Select “Solve equation” to update these steps.
          </div>
        )}
        <ol className="timeline" key={`${replay}-${detail}`}>
          {solution.steps.slice(0, count).map((step, i) => (
            <li
              className="step"
              key={step.id}
              style={{ animationDelay: `${Math.min(i * 70, 280)}ms` }}
            >
              <span className="step-number">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="step-content">
                <div className="step-heading">
                  <h3>{step.title}</h3>
                  {detail !== 'teach' && (
                    <button
                      className="why-button"
                      type="button"
                      aria-expanded={expanded.includes(step.id)}
                      aria-controls={`why-${detail}-${step.id}`}
                      onClick={() =>
                        setExpanded((items) =>
                          items.includes(step.id)
                            ? items.filter((id) => id !== step.id)
                            : [...items, step.id],
                        )
                      }
                    >
                      Why?
                      <Lightbulb size={13} />
                    </button>
                  )}
                </div>
                {detail === 'teach' && step.operation && step.before && (
                  <div
                    className="operation-demo"
                    aria-label={`Apply ${step.operation} to both sides`}
                  >
                    <div>
                      <MathText value={step.before.split('=')[0]} />
                      <span>{step.operation}</span>
                    </div>
                    <span>=</span>
                    <div>
                      <MathText value={step.before.split('=')[1]} />
                      <span>{step.operation}</span>
                    </div>
                  </div>
                )}
                <div className="step-equation">
                  <MathText value={step.equation} previous={step.before} />
                </div>
                {detail !== 'quick' && <p>{step.explanation}</p>}
                {(expanded.includes(step.id) || detail === 'teach') && (
                  <div className="why-detail" id={`why-${detail}-${step.id}`}>
                    <Lightbulb size={15} />
                    <p>{step.why}</p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
        {!complete && (
          <div className="reveal-controls">
            <button
              className="next-step-button"
              onClick={() => {
                setRevealed((v) => v + 1);
                setAnnouncement(
                  `Step ${count + 1} of ${solution.steps.length} revealed.`,
                );
              }}
            >
              Next step
              <ArrowRight size={16} />
            </button>
            <button
              className="text-button"
              onClick={() => {
                setRevealed(solution.steps.length);
                setAnnouncement('All solution steps revealed.');
              }}
            >
              Show all {solution.steps.length} steps
            </button>
            <span>
              {count} / {solution.steps.length}
            </span>
          </div>
        )}
        {complete && (
          <div className="answer-section">
            <div
              className={`answer-card ${solution.result !== 'unique' ? 'special-answer' : ''}`}
            >
              <div>
                <span className="label">
                  {solution.result === 'unique'
                    ? 'THERE IT IS. YOUR ANSWER.'
                    : 'WHAT THIS EQUATION TELLS US'}
                </span>
                {solution.result === 'unique' ? (
                  <MathText value={solution.answer} />
                ) : (
                  <div className="answer-text">{solution.answer}</div>
                )}
              </div>
              <span className="answer-check">
                <Check size={22} />
              </span>
            </div>
            {solution.check && (
              <div className="verification">
                <button
                  className="verify-button"
                  onClick={() => setVerified((v) => !v)}
                  aria-expanded={verified}
                  aria-controls="answer-verification"
                >
                  <ShieldCheck size={16} />
                  {verified ? 'Answer verified' : 'Let’s check the answer'}
                  <ChevronDown size={14} className={verified ? 'rotate' : ''} />
                </button>
                {verified && (
                  <div
                    id="answer-verification"
                    className="verification-content"
                  >
                    <p>
                      Replace {solution.variable} with {solution.value} in your
                      original equation.
                    </p>
                    <MathText value={solution.check.substitution} />
                    <div className="verified-equality">
                      <MathText value={solution.check.equality} />
                      <CheckCheck size={18} />
                    </div>
                    <span>Both sides match. You’ve got it.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="site-shell">
      <header className="site-header with-challenge">
        <a className="brand" href="#top" aria-label="Algebra with Khalid home">
          <span className="brand-mark" aria-hidden="true">
            x<span>·</span>
          </span>
          <span className="brand-name">
            Algebra<span>with Khalid</span>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <button onClick={() => setModal('about')}>How it works</button>
          <button onClick={() => setModal('examples')}>Examples</button>
          <DocumentLink href="/challenge" className="challenge-link">
            Challenge
          </DocumentLink>
          <button className="practice-nav" onClick={openPractice}>
            <GraduationCap size={17} />
            Practice
            <ArrowUpRight size={15} />
          </button>
        </nav>
      </header>
      <AccountMenu />
      {notice}
      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="eyebrow">
            <span className="little-spark">
              <Sparkles size={13} />
            </span>
            A LITTLE CLARITY GOES A LONG WAY
          </div>
          <h1 id="hero-title">
            Every equation.
            <br />
            <span>Every step, explained.</span>
          </h1>
          <p>Don’t just get the answer. Understand how to get there.</p>
        </section>
        <section className="equation-section" aria-label="Equation solver">
          <form
            className={`equation-form ${error ? 'has-error' : ''}`}
            onSubmit={(event) => {
              event.preventDefault();
              runSolve(input, { scroll: true, all: level === 'quick' });
            }}
          >
            <label htmlFor="equation">YOUR EQUATION</label>
            <div className="input-row">
              <span className="input-prefix" aria-hidden="true">
                ƒ
              </span>
              <input
                id="equation"
                ref={inputRef}
                aria-describedby={error ? 'equation-error' : 'equation-hint'}
                aria-invalid={!!error}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setError('');
                }}
                placeholder="e.g. 2x + 5 = 17"
                maxLength={240}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="off"
                enterKeyHint="go"
              />
              <button type="submit" className="primary-button">
                Solve equation
                <ArrowRight size={18} />
              </button>
            </div>
            <div className="input-note" id="equation-hint">
              <span>
                <span className="status-dot" />
                One-variable linear equations, including fractions.
              </span>
              <kbd>enter ↵</kbd>
            </div>
          </form>
          {error && (
            <div className="equation-error" id="equation-error" role="alert">
              <span className="error-icon">!</span>
              <div>
                <strong>Let’s take another look.</strong>
                <p>{error}</p>
              </div>
            </div>
          )}
          <div id="examples" className="example-row">
            <span>Try an example</span>
            {EXAMPLES.slice(0, 3).map((example) => (
              <button
                key={example.equation}
                type="button"
                onClick={() => chooseExample(example.equation)}
              >
                {example.equation.replace(/-/g, '−')}
                <ArrowUpRight size={12} />
              </button>
            ))}
          </div>
        </section>
        <div className="workspace">
          <section
            className="solution-column"
            id="solution"
            ref={resultRef}
            aria-label="Step-by-step solution"
          >
            <Tabs
              value={level}
              onValueChange={(value) => setLevel(value as Level)}
            >
              <div className="section-heading">
                <h2>
                  <span className="section-icon">
                    <BookOpen size={18} />
                  </span>
                  Let’s work through it
                </h2>
                <TabsList
                  className="explanation-tabs"
                  aria-label="Explanation detail"
                >
                  <TabsTrigger value="quick">Quick</TabsTrigger>
                  <TabsTrigger value="guided">Guided</TabsTrigger>
                  <TabsTrigger value="teach">Teach me</TabsTrigger>
                </TabsList>
              </div>
              {(['quick', 'guided', 'teach'] as const).map((value) => (
                <TabsContent value={value} key={value}>
                  {renderSolution(value)}
                </TabsContent>
              ))}
            </Tabs>
          </section>
          <aside className="support-column">
            <div className="insight-card">
              <span className="mini-icon">
                <Lightbulb size={20} />
              </span>
              <h3>It’s all about balance.</h3>
              <p>
                An equation is like a scale. Whatever you do to one side, do to
                the other.
              </p>
              <div
                className="balance-demo"
                aria-label="2x plus 5 equals 17. Subtract 5 from both sides to get 2x equals 12."
              >
                <span>
                  2<i>x</i> + <b>5</b>
                </span>
                <span>=</span>
                <span>17</span>
                <small>− 5</small>
                <span />
                <small>− 5</small>
                <span>
                  2<i>x</i>
                </span>
                <span>=</span>
                <span>12</span>
              </div>
              <span className="insight-footnote">
                Same operation. Both sides.
              </span>
            </div>
            <div className="history-card">
              <div className="history-heading">
                <h3>
                  <Clock3 size={16} />
                  Recent equations
                </h3>
                {history.length > 0 && (
                  <button
                    className="icon-button"
                    aria-label="Clear recent equations"
                    title="Clear recent equations"
                    onClick={clearHistory}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
              {history.length ? (
                <ul className="history-list">
                  {history.slice(0, 4).map((item) => (
                    <li key={item.at + item.equation}>
                      <button
                        onClick={() =>
                          runSolve(item.equation, { all: true, scroll: true })
                        }
                      >
                        <MathText value={item.equation} />
                        <ChevronRight size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-history">
                  Your next bit of clarity starts here.
                  <br />
                  Solved equations will appear here.
                </p>
              )}
              <div className="local-note">
                {historyAvailable
                  ? 'Recent list saved on this device; activity shared with your teacher'
                  : 'History is available for this visit only'}
              </div>
            </div>
            <button className="practice-card" onClick={openPractice}>
              <GraduationCap size={22} />
              <h3>
                A little practice.
                <br />A lot more confidence.
              </h3>
              <p>Try the next step yourself.</p>
              <span>
                Give it a go
                <ArrowRight size={15} />
              </span>
            </button>
          </aside>
        </div>
        <div className="bottom-note">
          <span className="status-dot" />
          Made for learning, one step at a time.
        </div>
      </main>
      <footer>
        <a className="footer-brand" href="#top">
          Algebra with Khalid<span>Make the math make sense.</span>
        </a>
        <span>Your school account. Your next step.</span>
      </footer>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent
          className={`solvex-dialog ${modal === 'examples' ? 'examples-dialog' : ''}`}
        >
          {modal === 'about' && (
            <>
              <span className="dialog-icon">
                <BookOpen size={23} />
              </span>
              <DialogTitle>Make the math make sense.</DialogTitle>
              <DialogDescription>
                Algebra with Khalid helps you understand how an equation works,
                one small step at a time.
              </DialogDescription>
              <ol className="how-list">
                <li>
                  <span>01</span>
                  <div>
                    <h3>Give us an equation.</h3>
                    <p>
                      Use one variable and an equals sign. Parentheses, negative
                      numbers, decimals, and fractions all work.
                    </p>
                  </div>
                </li>
                <li>
                  <span>02</span>
                  <div>
                    <h3>Follow the change.</h3>
                    <p>
                      Violet highlights show what changed. Choose Quick, Guided,
                      or Teach me for the detail you need.
                    </p>
                  </div>
                </li>
                <li>
                  <span>03</span>
                  <div>
                    <h3>Understand the why.</h3>
                    <p>
                      Open “Why?” for the reasoning, then check the answer in
                      the original equation.
                    </p>
                  </div>
                </li>
              </ol>
              <div className="scope-note">
                This version supports linear equations. Quadratics, square
                roots, and variables in denominators aren’t supported yet.
              </div>
              <button
                className="primary-button"
                onClick={() => {
                  setModal(null);
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
              >
                Let’s solve something
                <ArrowRight size={17} />
              </button>
            </>
          )}
          {modal === 'examples' && (
            <>
              <span className="dialog-icon">
                <Sparkles size={23} />
              </span>
              <DialogTitle>A good place to start.</DialogTitle>
              <DialogDescription>
                Choose an equation and see the reasoning unfold.
              </DialogDescription>
              <div className="examples-grid">
                {EXAMPLES.map((example) => (
                  <button
                    className="example-card"
                    key={example.equation}
                    onClick={() => chooseExample(example.equation)}
                  >
                    <span>
                      {example.category}
                      <ArrowUpRight size={14} />
                    </span>
                    <MathText value={example.equation} />
                    <small>{example.label}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          {modal === 'practice' && (
            <>
              <span className="dialog-icon">
                <GraduationCap size={24} />
              </span>
              <DialogTitle>Your turn to find a little clarity.</DialogTitle>
              <DialogDescription>
                What should the next equation be? Take any valid step toward
                isolating the variable.
              </DialogDescription>
              <div className="practice-equation">
                <span className="label">YOUR STARTING POINT</span>
                <MathText value={PRACTICE[practiceIndex]} />
              </div>
              <form
                className="practice-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  record('practice', PRACTICE[practiceIndex], studentStep);
                  setFeedback(
                    checkStudentStep(PRACTICE[practiceIndex], studentStep),
                  );
                }}
              >
                <label htmlFor="student-step">Your next step</label>
                <input
                  id="student-step"
                  value={studentStep}
                  onChange={(event) => {
                    setStudentStep(event.target.value);
                    setFeedback(null);
                  }}
                  placeholder="Enter the next equation"
                  maxLength={240}
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby={feedback ? 'practice-feedback' : undefined}
                />
                <button type="submit" className="primary-button">
                  Check my step
                  <Check size={17} />
                </button>
              </form>
              {feedback && (
                <output
                  id="practice-feedback"
                  className={`practice-feedback ${feedback.correct ? 'correct' : ''}`}
                >
                  {feedback.correct ? (
                    <CheckCheck size={18} />
                  ) : (
                    <Lightbulb size={18} />
                  )}
                  <p>{feedback.message}</p>
                </output>
              )}
              <div className="practice-actions">
                <button
                  className="text-button"
                  onClick={() => chooseExample(PRACTICE[practiceIndex])}
                >
                  Show the walkthrough
                  <ArrowRight size={14} />
                </button>
                <button className="text-button" onClick={nextPractice}>
                  Try another
                  <RotateCcw size={14} />
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

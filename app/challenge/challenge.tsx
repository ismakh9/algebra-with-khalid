'use client';

import { useEffect, useRef, useState } from 'react';
import { DocumentLink } from '@/components/document-link';
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
  awardCorrectAnswer,
  checkChallengeAnswer,
  generateChallenge,
  levelTopic,
  readProgress,
  type AnswerResult,
  type ChallengeProblem,
  type ChallengeProgress,
} from '@/lib/challenges';

const STORAGE_KEY = 'solvex:challenge-progress:v1';
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
  const [progress, setProgress] = useState<ChallengeProgress>({
    level: 1,
    correct: 0,
  });
  const [problem, setProblem] = useState<ChallengeProblem | null>(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const answerRef = useRef<HTMLInputElement>(null);
  const completed = feedback?.correct === true;

  /* oxlint-disable react/react-compiler -- Hydrate browser-only progress and generate randomness after SSR. */
  useEffect(() => {
    let saved = readProgress(null);
    try {
      saved = readProgress(localStorage.getItem(STORAGE_KEY));
    } catch {
      setStorageAvailable(false);
    }
    // oxlint-disable-next-line react/react-compiler -- Hydrate device-local progress and generate randomness only after server rendering.
    setProgress(saved);
    setProblem(generateChallenge(saved.level));
  }, []);
  /* oxlint-enable react/react-compiler */

  function nextProblem() {
    setProblem(generateChallenge(progress.level, problem?.equation));
    setAnswer('');
    setFeedback(null);
    setShowHint(false);
    requestAnimationFrame(() => answerRef.current?.focus());
  }
  function submitAnswer() {
    if (!problem || completed) return;
    const result = checkChallengeAnswer(problem, answer);
    setFeedback(result);
    if (result.correct) {
      const next = awardCorrectAnswer(progress, problem.level);
      setProgress(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setStorageAvailable(true);
      } catch {
        setStorageAvailable(false);
      }
    }
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
          <p>A fresh equation. A new level. Your own pace.</p>
        </section>
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
                      submitAnswer();
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
                        disabled={completed}
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
                        disabled={completed}
                      >
                        {completed ? (
                          <>
                            <Check size={17} />
                            Correct
                          </>
                        ) : (
                          <>
                            Check answer
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
                      <button className="primary-button" onClick={nextProblem}>
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
                      <button className="text-button" onClick={nextProblem}>
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
              {storageAvailable
                ? 'Your progress is saved on this device.'
                : 'Your progress is saved for this visit.'}
            </p>
          </aside>
        </div>
        <div className="bottom-note">
          <span className="status-dot" />
          Progress comes from practice, not perfection.
        </div>
      </main>
      <footer>
        <DocumentLink href="/" className="footer-brand">
          Algebra with Khalid<span>Make the math make sense.</span>
        </DocumentLink>
        <span>No accounts. Just algebra.</span>
      </footer>
    </div>
  );
}

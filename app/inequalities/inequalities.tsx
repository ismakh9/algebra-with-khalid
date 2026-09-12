'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChartNoAxesColumnIncreasing } from 'lucide-react';
import { AccountMenu, SchoolBrand } from '@/components/school-auth';
import { DocumentLink } from '@/components/document-link';
import { useActivityRecorder } from '@/components/school-activity';
import { Fraction } from '@/lib/solver';
import { solveInequality, type InequalitySolution } from '@/lib/inequalities';

const EXAMPLES = ['2x + 5 ≤ 17', '-3x + 6 > 12', '-2 < x ≤ 5', 'x < -2 or x ≥ 3'];

export function NumberLine({ solution }: { solution: InequalitySolution }) {
  const endpoints = [...new Map(solution.intervals.flatMap(i => [i.lower, i.upper]).filter((x): x is Fraction => x !== null).map(x => [x.toString(), x])).values()].sort((a, b) => a.sub(b).n < 0n ? -1 : a.equals(b) ? 0 : 1);
  // Exact labels with schematic spacing keep tiny fractions and large bounds distinct.
  const ticks = endpoints.length === 1 ? [endpoints[0].sub(new Fraction(1)), endpoints[0], endpoints[0].add(new Fraction(1))] : endpoints.length ? endpoints : [new Fraction(-1), new Fraction(0), new Fraction(1)];
  const position = (x: Fraction) => 110 + ticks.findIndex(t => t.equals(x)) * 380 / (ticks.length - 1);
  return <figure className="ineq-number-line">
    <figcaption>Number line <span>Shaded values are solutions · not to scale</span></figcaption>
    {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- An inline SVG chart needs an accessible image role. */}
    <svg viewBox="0 0 600 155" role="img" aria-label={`Solution on the number line: ${solution.interval}. ${solution.intervals.length ? 'Open circles exclude endpoints; filled circles include them.' : 'No values are shaded because there is no solution.'}`}>
      <path d="M24 76 H576 M24 76 l10 -5 M24 76 l10 5 M576 76 l-10 -5 M576 76 l-10 5" fill="none" stroke="#a5a0b2" strokeWidth="2" />
      {ticks.map(t => <g key={t.toString()}><path d={`M${position(t)} 69 v14`} stroke="#a5a0b2" strokeWidth="2" /><text x={position(t)} y="112" textAnchor="middle" fill="#595063" fontSize="16">{t.toString()}</text></g>)}
      {solution.intervals.map((i, index) => {
        const left = i.lower ? position(i.lower) : 25;
        const right = i.upper ? position(i.upper) : 575;
        return <g key={index} stroke="#6a54d7" strokeWidth="5">
          <path d={`M${left} 76 H${right}`} />
          {i.lower ? <circle cx={left} cy="76" r="7" fill={i.lowerClosed ? '#6a54d7' : '#fff'} strokeWidth="3" /> : <path d="M37 67 L25 76 L37 85" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
          {i.upper ? <circle cx={right} cy="76" r="7" fill={i.upperClosed ? '#6a54d7' : '#fff'} strokeWidth="3" /> : <path d="M563 67 L575 76 L563 85" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        </g>;
      })}
      {!solution.intervals.length && <text x="300" y="35" textAnchor="middle" fill="#595063" fontSize="17">No solution</text>}
    </svg>
    <div className="ineq-legend"><span><i /> Endpoint excluded</span><span><i className="filled" /> Endpoint included</span></div>
  </figure>;
}

export default function Inequalities() {
  const [input, setInput] = useState(EXAMPLES[0]);
  const [solution, setSolution] = useState<InequalitySolution | null>(() => solveInequality(EXAMPLES[0]));
  const [error, setError] = useState('');
  const { record, notice } = useActivityRecorder();
  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const query = new URLSearchParams(window.location.search).get('q');
    if (!query) return;
    // oxlint-disable-next-line react/react-compiler -- Restore a problem submitted from the equation page after hydration.
    setInput(query);
    try { setSolution(solveInequality(query)); record('solve', query); }
    catch (cause) { setSolution(null); setError(cause instanceof Error ? cause.message : 'Check your inequality and try again.'); }
  }, [record]);
  function solve(value: string) {
    setInput(value); setError('');
    try { setSolution(solveInequality(value)); record('solve', value); }
    catch (cause) { setSolution(null); setError(cause instanceof Error ? cause.message : 'Check your inequality and try again.'); }
  }
  const stale = solution !== null && input.trim() !== solution.input;
  return <div className="site-shell inequality-page">
    <header className="site-header"><SchoolBrand /><nav aria-label="Main navigation"><DocumentLink href="/" className="back-to-solver"><ArrowLeft size={15} />Equation solver</DocumentLink><DocumentLink href="/challenge">Challenge</DocumentLink></nav></header>
    <AccountMenu />{notice}
    <main className="ineq-main">
      <section className="hero ineq-hero"><div className="eyebrow"><ChartNoAxesColumnIncreasing size={14} />EXPLORE THE POSSIBILITIES</div><h1>More than one answer.<br /><span>Every possibility, shown.</span></h1><p>Solve an inequality. See its interval. Find it on the number line.</p></section>
      <form className="equation-form" onSubmit={e => { e.preventDefault(); solve(input); }}>
        <label htmlFor="inequality-input">YOUR INEQUALITY</label>
        <div className="input-row"><input id="inequality-input" value={input} onChange={e => { setInput(e.target.value); setError(''); }} placeholder="e.g. 2x + 5 ≤ 17" maxLength={240} autoComplete="off" autoCapitalize="off" spellCheck={false} aria-invalid={!!error} aria-describedby={error ? 'inequality-error' : 'inequality-help'} /><button type="submit" className="primary-button">Solve inequality<ArrowRight size={17} /></button></div>
        <p id="inequality-help" className="ineq-help">Use &lt;, &lt;=, &gt; or &gt;=. Linear inequalities, fractions, parentheses, and “and” / “or” are supported.</p>
      </form>
      <div className="example-row"><span>Try an example</span>{EXAMPLES.map(example => <button type="button" key={example} onClick={() => solve(example)}>{example}</button>)}</div>
      {error && <p className="ineq-error" role="alert" id="inequality-error">{error}</p>}
      {stale && <output className="ineq-pending">Press “Solve inequality” to update the answer and graph.</output>}
      {solution && !stale && <section className="ineq-results" aria-label="Inequality solution" aria-live="polite">
        <div className="ineq-answer"><span className="ineq-kicker"><Check size={17} />SOLUTION IN INTERVAL NOTATION</span><h2>{solution.interval}</h2><p>{solution.intervals.length === 0 ? 'The empty set: no real number satisfies this inequality.' : solution.interval === '(-∞, ∞)' ? 'Every real number satisfies this inequality.' : 'Brackets include an endpoint. Parentheses exclude it. Infinity always uses parentheses.'}</p></div>
        <NumberLine solution={solution} />
        <div className="ineq-steps"><h2>Let’s work through it</h2><p className="ineq-original">{solution.input}</p><ol>{solution.steps.map((step, index) => <li key={index}><span className="ineq-step-number">{index + 1}</span><div><h3>{step.title}</h3><p className="ineq-step-math">{step.math}</p><p>{step.explanation}</p></div></li>)}</ol></div>
      </section>}
    </main>
    <footer><DocumentLink href="/" className="footer-brand">Algebra with Khalid<span>Make the math make sense.</span></DocumentLink><span>Your school account. Your next step.</span></footer>
  </div>;
}

import { EquationError, Fraction, linearRelation } from './solver.ts';

export type Interval = { lower: Fraction | null; upper: Fraction | null; lowerClosed: boolean; upperClosed: boolean };
export type InequalityStep = { title: string; math: string; explanation: string };
export type InequalitySolution = { input: string; variable: string; intervals: Interval[]; interval: string; steps: InequalityStep[] };
type Operator = '<' | '<=' | '>' | '>=';
const zero = new Fraction(0);
const all: Interval = { lower: null, upper: null, lowerClosed: false, upperClosed: false };
const compare = (a: Fraction, b: Fraction) => { const d = a.sub(b).n; return d < 0n ? -1 : d > 0n ? 1 : 0; };
const display = (op: Operator) => op === '<=' ? '≤' : op === '>=' ? '≥' : op;
const reverse = (op: Operator): Operator => ({ '<': '>', '<=': '>=', '>': '<', '>=': '<=' })[op] as Operator;
const valid = (i: Interval) => !i.lower || !i.upper || compare(i.lower, i.upper) < 0 || (compare(i.lower, i.upper) === 0 && i.lowerClosed && i.upperClosed);
const term = (a: Fraction, b: Fraction, v: string) => {
  if (a.zero) return b.toString();
  const head = `${a.one ? '' : a.equals(new Fraction(-1)) ? '-' : a.toString()}${v}`;
  return b.zero ? head : `${head} ${b.n < 0n ? '-' : '+'} ${b.abs().toString()}`;
};

function intersect(a: Interval, b: Interval): Interval | null {
  const lowerOrder = !a.lower ? -1 : !b.lower ? 1 : compare(a.lower, b.lower);
  const upperOrder = !a.upper ? 1 : !b.upper ? -1 : compare(a.upper, b.upper);
  const i = {
    lower: lowerOrder >= 0 ? a.lower : b.lower,
    lowerClosed: lowerOrder === 0 ? a.lowerClosed && b.lowerClosed : lowerOrder > 0 ? a.lowerClosed : b.lowerClosed,
    upper: upperOrder <= 0 ? a.upper : b.upper,
    upperClosed: upperOrder === 0 ? a.upperClosed && b.upperClosed : upperOrder < 0 ? a.upperClosed : b.upperClosed,
  };
  return valid(i) ? i : null;
}
function union(intervals: Interval[]): Interval[] {
  const sorted = intervals.map(i => ({ ...i })).sort((a, b) => !a.lower ? -1 : !b.lower ? 1 : compare(a.lower, b.lower) || Number(b.lowerClosed) - Number(a.lowerClosed));
  const result: Interval[] = [];
  for (const i of sorted) {
    const last = result.at(-1);
    if (!last) { result.push(i); continue; }
    const gap = last.upper && i.lower ? compare(last.upper, i.lower) : 1;
    if (gap < 0 || (gap === 0 && !last.upperClosed && !i.lowerClosed)) { result.push(i); continue; }
    if (!last.upper) continue;
    if (!i.upper || compare(i.upper, last.upper) > 0) { last.upper = i.upper; last.upperClosed = i.upperClosed; }
    else if (compare(i.upper, last.upper) === 0) last.upperClosed ||= i.upperClosed;
  }
  return result;
}
export function intervalNotation(intervals: Interval[]): string {
  return intervals.length ? intervals.map(i => `${i.lowerClosed ? '[' : '('}${i.lower?.toString() ?? '-∞'}, ${i.upper?.toString() ?? '∞'}${i.upperClosed ? ']' : ')'}`).join(' ∪ ') : '∅';
}
function solvePair(left: string, op: Operator, right: string, variable: string) {
  const parsed = linearRelation(`${left}=${right}`);
  const a = parsed.left.a.sub(parsed.right.a);
  const b = parsed.right.b.sub(parsed.left.b);
  const steps: InequalityStep[] = [{ title: 'Simplify each side', math: `${term(parsed.left.a, parsed.left.b, variable)} ${display(op)} ${term(parsed.right.a, parsed.right.b, variable)}`, explanation: 'Expand parentheses and combine like terms on each side.' },
    { title: 'Collect the variable and constant terms', math: `${term(a, zero, variable)} ${display(op)} ${b.toString()}`, explanation: 'Subtract the right-side variable term and the left-side constant from both sides. The inequality direction stays the same.' }];
  if (a.zero) {
    const c = compare(zero, b);
    const truth = op === '<' ? c < 0 : op === '<=' ? c <= 0 : op === '>' ? c > 0 : c >= 0;
    steps.push({ title: truth ? 'Every real number works' : 'No value works', math: truth ? '(-∞, ∞)' : '∅', explanation: `The variable cancels out. The remaining statement is ${truth ? 'always true' : 'false'}.` });
    return { steps, intervals: truth ? [{ ...all }] : [] };
  }
  const bound = b.div(a);
  const finalOp = a.n < 0n ? reverse(op) : op;
  const below = finalOp.startsWith('<');
  const closed = finalOp.endsWith('=');
  steps.push({ title: a.n < 0n ? `Divide by ${a.toString()} and reverse the inequality` : `Divide by ${a.toString()}`, math: `${variable} ${display(finalOp)} ${bound.toString()}`, explanation: a.n < 0n ? 'Dividing both sides by a negative number reverses the inequality sign.' : 'Dividing both sides by a positive number keeps the inequality sign unchanged.' });
  return { steps, intervals: [{ lower: below ? null : bound, upper: below ? bound : null, lowerClosed: !below && closed, upperClosed: below && closed }] };
}

/** Exact solutions for linear inequalities, chained bounds, AND and OR. */
export function solveInequality(raw: string): InequalitySolution {
  if (!raw.trim() || raw.length > 240) throw new EquationError('Enter an inequality of up to 240 characters, like 2x + 5 ≤ 17.');
  const input = raw.trim().replace(/[−–—]/g, '-').replace(/≤/g, '<=').replace(/≥/g, '>=').toLowerCase();
  const letters = input.replace(/\b(?:and|or)\b/g, '').match(/[a-z]/g) ?? [];
  const variables = [...new Set(letters)];
  if (variables.length > 1) throw new EquationError('Use one variable at a time, such as x.');
  const variable = variables[0] ?? 'x';
  const steps: InequalityStep[] = [];
  const groups: Interval[] = [];
  let pairCount = 0;
  for (const disjunction of input.split(/\bor\b/)) {
    let current: Interval[] = [{ ...all }];
    for (const conjunction of disjunction.split(/\band\b/)) {
      const parts = conjunction.split(/(<=|>=|<|>)/);
      if (parts.length < 3 || parts.some(p => !p.trim())) throw new EquationError('Use <, ≤, > or ≥ between expressions. For example: -2 < x ≤ 5.');
      for (let i = 1; i < parts.length; i += 2) {
        pairCount++;
        const pair = solvePair(parts[i - 1], parts[i] as Operator, parts[i + 1], variable);
        steps.push(...pair.steps);
        current = current.flatMap(a => pair.intervals.flatMap(b => { const intersection = intersect(a, b); return intersection ? [intersection] : []; }));
      }
    }
    groups.push(...current);
  }
  const intervals = union(groups);
  const interval = intervalNotation(intervals);
  if (pairCount > 1) steps.push({ title: 'Combine the solution sets', math: interval, explanation: 'For chained bounds and “and”, keep values satisfying every condition. For “or”, include values satisfying either condition.' });
  return { input: raw.trim(), variable, intervals, interval, steps };
}

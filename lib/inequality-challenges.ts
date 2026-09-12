import { generateChallenge, type AnswerResult } from './challenges.ts';
import { Fraction } from './solver.ts';
import { solveInequality, intervalNotation, normalizeIntervals, type Interval } from './inequalities.ts';

export const INEQUALITY_TOPICS = ['One-step bounds', 'Inclusive endpoints', 'Positive coefficients', 'Negative coefficients', 'Two-step inequalities', 'Parentheses', 'Variables on both sides', 'Fractional endpoints', 'Compound bounds', 'Either/or intervals', 'Advanced inequalities'];
export const inequalityTopic = (level: number) => INEQUALITY_TOPICS[Math.min(10, Math.max(0, level - 1))];
export function generateInequalityChallenge(level: number, previous = '', random: () => number = Math.random) {
  const safeLevel = Math.max(1, Math.min(1_000_000, Math.floor(level) || 1));
  const int = (min: number, max: number) => min + Math.floor(Math.max(0, Math.min(.99999999, random())) * (max - min + 1));
  const create = () => {
    const a = int(2, 9), b = int(1, 12), c = int(1, 12);
    const op = ['<', '≤', '>', '≥'][int(0, 3)];
    if (safeLevel === 1) return `x + ${b} ${int(0, 1) ? '<' : '>'} ${b+c}`;
    if (safeLevel === 2) return `x - ${b} ${int(0, 1) ? '≤' : '≥'} ${c}`;
    if (safeLevel === 3) return `${a}x ${op} ${a*c}`;
    if (safeLevel === 4) return `-${a}x ${op} ${a*c}`;
    if (safeLevel === 5) return `-${a}x + ${b} ${op} ${c}`;
    if (safeLevel === 9) return `-${b} ${int(0, 1) ? '<' : '≤'} ${a}x + ${c} ${int(0, 1) ? '<' : '≤'} ${a*c+b}`;
    if (safeLevel === 10) return `${a}x < -${b} or ${a}x ≥ ${c}`;
    const equationLevel = safeLevel === 6 ? 6 : safeLevel === 7 ? 7 : safeLevel === 8 ? 8 : safeLevel + 1;
    return generateChallenge(equationLevel, '', random).equation.replace('=', op);
  };
  let equation = create();
  for (let attempt = 0; equation === previous && attempt < 8; attempt++) equation = create();
  if (equation === previous) equation = equation.replace(/\d+/, n => String(Number(n) + 1));
  // Fail here if a future generator accidentally introduces unsupported math.
  const solution = solveInequality(equation);
  return { equation, level: safeLevel, topic: `Inequalities: ${inequalityTopic(safeLevel)}`, hint: solution.steps[0].explanation };
}

function endpoint(value: string): Fraction | null {
  if (/^[+-]?∞$/.test(value)) return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:\/[+-]?(?:\d+(?:\.\d*)?|\.\d+))?$/.test(value)) throw new Error('Invalid endpoint');
  const [n, d] = value.split('/');
  return Fraction.parse(n).div(d === undefined ? new Fraction(1) : Fraction.parse(d));
}
export function parseIntervalAnswer(raw: string): string {
  if (raw.length > 240) throw new Error('Answer too long');
  const input = raw.trim().toLowerCase().replace(/[−–—]/g, '-').replace(/infinity|infty|inf/g, '∞').replace(/\s/g, '');
  if (['∅', '{}', 'empty', 'emptyset', 'nosolution'].includes(input)) return '∅';
  const intervals: Interval[] = [];
  for (const part of input.split(/union|∪|u/)) {
    const match = part.match(/^([[(])([^,]+),([^,]+)([\])])$/);
    if (!match) throw new Error('Use interval notation');
    const [, left, lowerText, upperText, right] = match;
    const lower = endpoint(lowerText), upper = endpoint(upperText);
    if ((!lower && (lowerText !== '-∞' || left !== '(')) || (!upper && (!['∞', '+∞'].includes(upperText) || right !== ')'))) throw new Error('Infinity uses parentheses');
    if (lower && upper && lower.sub(upper).n > 0n) throw new Error('Put the smaller endpoint first');
    if (lower && upper && lower.equals(upper) && (left !== '[' || right !== ']')) continue;
    intervals.push({ lower, upper, lowerClosed: left === '[', upperClosed: right === ']' });
  }
  return intervalNotation(normalizeIntervals(intervals));
}
export function checkInequalityAnswer(equation: string, answer: string): AnswerResult {
  try {
    const actual = parseIntervalAnswer(answer);
    const correct = actual === solveInequality(equation).interval;
    return { correct, valid: true, message: correct ? 'Correct! Your next inequality level is unlocked.' : 'Not quite. Check the boundary, which direction is shaded, and whether the endpoint is included.' };
  } catch {
    return { correct: false, valid: false, message: 'Use interval notation, such as (-inf, 3], (2, inf), or (-inf, -2) U [3, inf). Infinity always uses parentheses.' };
  }
}

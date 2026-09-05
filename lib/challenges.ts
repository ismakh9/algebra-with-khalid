import { Fraction, solveEquation, type Solution } from './solver.ts';

export type ChallengeProblem = {
  equation: string;
  level: number;
  topic: string;
  solution: Solution;
};
export type ChallengeProgress = { level: number; correct: number };
export type AnswerResult = {
  correct: boolean;
  valid: boolean;
  message: string;
};
const MAX_LEVEL = 1_000_000;

export const CHALLENGE_TOPICS = [
  'Simple addition',
  'Simple subtraction',
  'Multiplication',
  'Two-step equations',
  'Negative numbers',
  'Parentheses',
  'Variables on both sides',
  'Fractional answers',
  'Nested expressions',
  'Fractions on both sides',
  'Fractions & parentheses',
  'Advanced linear equations',
];
export function levelTopic(level: number): string {
  return CHALLENGE_TOPICS[
    Math.min(Math.max(Math.floor(level) - 1, 0), CHALLENGE_TOPICS.length - 1)
  ];
}
export function readProgress(stored: string | null): ChallengeProgress {
  try {
    const value: unknown = JSON.parse(stored || 'null');
    if (
      value &&
      typeof value === 'object' &&
      'level' in value &&
      typeof value.level === 'number' &&
      Number.isSafeInteger(value.level) &&
      value.level >= 1 &&
      value.level <= MAX_LEVEL
    )
      return { level: value.level, correct: value.level - 1 };
  } catch {
    /* Corrupt or unavailable storage starts a fresh challenge. */
  }
  return { level: 1, correct: 0 };
}
/** A problem earns its level once. Repeated submissions cannot skip levels. */
export function awardCorrectAnswer(
  progress: ChallengeProgress,
  problemLevel: number,
): ChallengeProgress {
  if (problemLevel !== progress.level || progress.level >= MAX_LEVEL)
    return progress;
  return { level: progress.level + 1, correct: progress.correct + 1 };
}
function fractionFromText(text: string): Fraction {
  const [numerator, denominator] = text.split('/').map((part) => part.trim());
  const top = Fraction.parse(numerator);
  return denominator === undefined ? top : top.div(Fraction.parse(denominator));
}
export function checkChallengeAnswer(
  problem: ChallengeProblem,
  raw: string,
): AnswerResult {
  const value = raw
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/^x\s*=\s*/i, '')
    .trim();
  const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
  if (
    raw.length > 100 ||
    !new RegExp(`^${number}(?:\\s*/\\s*${number})?$`).test(value)
  )
    return {
      correct: false,
      valid: false,
      message:
        'Enter the value of x as a number or fraction, like 6, -2, or 3/2.',
    };
  try {
    const proposed = fractionFromText(value);
    const expected = fractionFromText(problem.solution.value || '0');
    if (proposed.equals(expected))
      return {
        correct: true,
        valid: true,
        message: 'You’ve got it. The next level is unlocked.',
      };
    return {
      correct: false,
      valid: true,
      message:
        'Not quite yet. Check your arithmetic and try again. Use an exact fraction if your answer has a repeating decimal.',
    };
  } catch {
    return {
      correct: false,
      valid: false,
      message:
        'Check that fraction. Its denominator can’t be zero, and the numbers need to fit in the answer box.',
    };
  }
}

/** Randomized templates remain linear and increase in complexity and number size. */
export function generateChallenge(
  level: number,
  previous = '',
  random: () => number = Math.random,
): ChallengeProblem {
  const safeLevel = Number.isFinite(level)
    ? Math.min(MAX_LEVEL, Math.max(1, Math.floor(level)))
    : 1;
  const integer = (min: number, max: number) =>
    Math.floor(Math.min(0.999999999, Math.max(0, random())) * (max - min + 1)) +
    min;
  const signed = (min: number, max: number) =>
    integer(min, max) * (integer(0, 1) ? 1 : -1);
  const sum = (first: string, n: number) =>
    `${first} ${n < 0 ? '-' : '+'} ${Math.abs(n)}`;
  // After the concept ladder, every level raises the coefficient range.
  const floor = safeLevel <= 12 ? 2 : safeLevel - 10;
  const ceiling = floor + 7;
  for (let attempt = 0; attempt < 24; attempt++) {
    const a = integer(floor, ceiling),
      b = integer(1, ceiling),
      c = integer(floor, ceiling);
    const d = integer(2, ceiling),
      e = integer(1, ceiling),
      f = integer(2, ceiling);
    const n = integer(1, 12),
      sign = signed(1, ceiling);
    let equation: string;
    if (safeLevel === 1) equation = `x + ${b} = ${n + b}`;
    else if (safeLevel === 2) equation = `x - ${b} = ${n}`;
    else if (safeLevel === 3) equation = `${a}x = ${a * n}`;
    else if (safeLevel === 4) equation = `${a}x + ${b} = ${a * n + b}`;
    else if (safeLevel === 5)
      equation = `${sum(`-${a}x`, sign)} = ${-a * signed(1, 12) + sign}`;
    else if (safeLevel === 6)
      equation = `${sum(`${a}(${sum('x', sign)})`, b)} = ${a * (n + sign) + b}`;
    else if (safeLevel === 7) {
      const other = a + integer(1, 5);
      equation = `${a}x + ${b} = ${sum(`${other}x`, (a - other) * n + b)}`;
    } else if (safeLevel === 8) {
      // An off-multiple constant guarantees a noninteger solution.
      const constant = a * integer(1, 4) + 1;
      equation = `(${a}x + ${constant})/${d} = ${a * n}`;
    } else if (safeLevel === 9) {
      const other = a * b + 1;
      equation = `${sum(`${a}(${sum(`${b}x`, sign)})`, d)} = ${sum(`${other}(x + ${e})`, signed(1, 20))}`;
    } else if (safeLevel === 10) {
      // Distinct denominator-weighted coefficients guarantee one solution.
      const other = a * f === c * d ? c + 1 : c;
      equation = `(${sum(`${a}x`, sign)})/${d} = (${other}x + ${e})/${f}`;
    } else {
      const other = a * b * f === c * d ? c + 1 : c;
      const left =
        safeLevel >= 15
          ? `${a}(${b}(${sum('x', sign)}) + ${e})`
          : `${a}(${sum(`${b}x`, sign)})`;
      equation = `(${left} + ${d})/${d} = (${other}(x + ${e}) + ${b})/${f}`;
      if (safeLevel >= 12) equation += ` + ${e}/${a + 1}`;
      if (safeLevel >= 18)
        equation = `(${left} + ${d})/${d} + (x + ${e})/${f + 1} = (${other}(x + ${e}) + ${b})/${f} + ${e}/${a + 1}`;
    }
    const solution = solveEquation(equation);
    if (solution.result === 'unique' && equation !== previous)
      return {
        equation,
        level: safeLevel,
        topic: levelTopic(safeLevel),
        solution,
      };
  }
  // Even a pathological random source cannot cause a hang or repeat a problem.
  const fallback = generateChallenge(safeLevel, '', () => 0.43);
  if (fallback.equation !== previous) return fallback;
  const [left, right] = fallback.equation.split('=');
  const equation = `${left.trim()} + 1 = ${right.trim()} + 2`;
  return { ...fallback, equation, solution: solveEquation(equation) };
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveInequality, type Interval } from '../lib/inequalities.ts';
import { Fraction, solveEquation } from '../lib/solver.ts';
import { evaluateActivity } from '../lib/activity.ts';
import { pageUrl } from '../lib/school.ts';

const cases: [string, string][] = [
  ['2x + 5 ≤ 17', '(-∞, 6]'], ['-3x + 6 > 12', '(-∞, -2)'],
  ['-2x <= 5', '[-5/2, ∞)'], ['x/3 > 2', '(6, ∞)'],
  ['x/-2 >= 3', '(-∞, -6]'], ['2(x - 3) ≥ x + 1', '[7, ∞)'],
  ['3x+1 < 5x-7', '(4, ∞)'], ['0.5x + 0.1 < .4', '(-∞, 3/5)'],
  ['(x+2)/5 ≤ (3x-1)/4', '[13/11, ∞)'],
  ['3 > x', '(-∞, 3)'], ['3 >= -x', '[-3, ∞)'],
  ['-2 < x ≤ 5', '(-2, 5]'], ['5 ≥ x > -2', '(-2, 5]'],
  ['1 < 2x+3 <= 9', '(-1, 3]'], ['x ≥ 1 and x ≤ 1', '[1, 1]'],
  ['x < 1 and x >= 1', '∅'], ['x > 5 and x < 2', '∅'],
  ['x < -2 or x >= 3', '(-∞, -2) ∪ [3, ∞)'],
  ['x < 2 or x > 2', '(-∞, 2) ∪ (2, ∞)'],
  ['x <= 2 or x > 2', '(-∞, ∞)'],
  ['x < 0 or x > -1', '(-∞, ∞)'],
  ['x >= 0 and x < 1 or x >= 1 and x < 2', '[0, 2)'],
  ['x > 0 and x < 1 or x > 1 and x < 2', '(0, 1) ∪ (1, 2)'],
  ['x < x+1', '(-∞, ∞)'], ['x > x+1', '∅'],
  ['2(x+1) <= 2x+2', '(-∞, ∞)'], ['2(x+1) < 2x+2', '∅'],
  ['3 < 4', '(-∞, ∞)'], ['3 >= 4', '∅'], ['4Y ≥ 7', '[7/4, ∞)'],
];
for (const [input, expected] of cases) await test(`interval solution: ${input}`, () => {
  assert.equal(solveInequality(input).interval, expected);
});
await test('negative division reverses the sign and explains it', () => {
  const last = solveInequality('-3x+6>12').steps.at(-1)!;
  assert.match(last.title, /reverse/);
  assert.equal(last.math, 'x < -2');
  assert.doesNotMatch(solveInequality('3x<6').steps.at(-1)!.title, /reverse/);
});
await test('invalid and nonlinear input never produces a misleading interval', () => {
  for (const input of ['', 'x=2', 'x <> 2', 'x <', '<x', 'x < y', 'x^2 < 4', '1/x < 2', 'x*x > 3', 'x/0 > 2', 'x < 2 or', 'and x<2', '(x<2 or x>4)', 'x < 2;alert(1)', 'x'.repeat(241)]) assert.throws(() => solveInequality(input), Error, input);
});
await test('exact boundaries and solution membership agree with independent arithmetic', () => {
  const contains = (intervals: Interval[], x: Fraction) => intervals.some(i =>
    (!i.lower || x.sub(i.lower).n > 0n || (i.lowerClosed && x.equals(i.lower))) &&
    (!i.upper || x.sub(i.upper).n < 0n || (i.upperClosed && x.equals(i.upper))));
  for (let a = -6; a <= 6; a++) for (let c = -3; c <= 3; c++) for (const op of ['<', '<=', '>', '>=']) {
    const solution = solveInequality(`${a}x + 3 ${op} ${c}x - 4`);
    const probes = [-5, -1, 0, 1, 5].map(n => new Fraction(n));
    if (a !== c) probes.push(new Fraction(-7, a-c));
    for (const x of probes) {
      const difference = new Fraction(a-c).mul(x).add(new Fraction(7)).n;
      const expected = op === '<' ? difference < 0n : op === '<=' ? difference <= 0n : op === '>' ? difference > 0n : difference >= 0n;
      assert.equal(contains(solution.intervals, x), expected, `${a}, ${c}, ${op}, ${x.toString()}`);
    }
  }
});
await test('equation solving and static routing stay compatible', () => {
  assert.equal(solveEquation('3(2x-5)+4=19').value, '5');
  assert.equal(pageUrl('/inequalities', '/algebra-with-khalid'), '/algebra-with-khalid/inequalities.html');
  assert.equal(pageUrl('/inequalities'), '/inequalities');
});

await test('inequality views remain visible to the teacher without changing equation grading', () => {
  assert.deepEqual(evaluateActivity('solve', '-2 < x ≤ 5'), { topic: 'Inequalities', correct: null, result: 'viewed' });
  assert.equal(evaluateActivity('practice', '2x+5=17', 'x=6').correct, true);
});

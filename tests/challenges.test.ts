import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  awardCorrectAnswer,
  checkChallengeAnswer,
  generateChallenge,
  levelTopic,
  readProgress,
} from '../lib/challenges.ts';
import { solveEquation } from '../lib/solver.ts';

function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

await test('generated equations have one verified solution across the full difficulty ladder', () => {
  const random = seeded(4721);
  for (const level of [
    ...Array.from({ length: 24 }, (_, i) => i + 1),
    50,
    100,
    1000,
    1000000,
  ]) {
    for (let i = 0; i < 25; i++) {
      const problem = generateChallenge(level, '', random);
      assert.equal(problem.level, level);
      assert.equal(problem.solution.result, 'unique', problem.equation);
      assert.equal(problem.solution.check?.valid, true);
      assert.equal(
        solveEquation(problem.equation).value,
        problem.solution.value,
      );
      assert.ok(problem.equation.length <= 240);
      assert.equal(
        checkChallengeAnswer(problem, problem.solution.value!).correct,
        true,
      );
    }
  }
});
await test('random generation produces varied problems and skips cannot repeat the current one', () => {
  const random = seeded(120);
  const equations = new Set(
    Array.from({ length: 40 }, () => generateChallenge(1, '', random).equation),
  );
  assert.ok(equations.size > 25);
  for (const level of [1, 4, 8, 11, 18, 35]) {
    const first = generateChallenge(level, '', () => 0.43);
    const second = generateChallenge(level, first.equation, () => 0.43);
    assert.notEqual(first.equation, second.equation);
    assert.equal(first.level, second.level);
  }
});
await test('correct answers advance exactly one level and cannot be awarded twice', () => {
  const current = { level: 4, correct: 3 };
  const next = awardCorrectAnswer(current, 4);
  assert.deepEqual(next, { level: 5, correct: 4 });
  assert.deepEqual(awardCorrectAnswer(next, 4), next);
  assert.deepEqual(awardCorrectAnswer(current, 5), current);
});
await test('difficulty adds concepts, then increases the coefficient range', () => {
  assert.equal(levelTopic(1), 'Simple addition');
  assert.equal(levelTopic(8), 'Fractional answers');
  assert.match(generateChallenge(6, '', () => 0.43).equation, /\(/);
  assert.match(generateChallenge(10, '', () => 0.43).equation, /\/.+=.+\//);
  assert.match(generateChallenge(15, '', () => 0.43).equation, /\(.*\(.*\(/);
  const low = generateChallenge(20, '', () => 0.43).equation.match(
    /^\(?(\d+)/,
  )?.[1];
  const high = generateChallenge(40, '', () => 0.43).equation.match(
    /^\(?(\d+)/,
  )?.[1];
  assert.ok(Number(high) > Number(low));
  for (let i = 0; i < 30; i++)
    assert.match(generateChallenge(8, '', seeded(i + 1)).solution.value!, /\//);
});
await test('answer checks accept equivalent fractions, decimals, signs, and x = notation', () => {
  const problem = { ...generateChallenge(1), solution: solveEquation('2x=3') };
  for (const answer of ['3/2', '6/4', '1.5', 'x = 1.5', 'X=3/2', ' -3 / -2 '])
    assert.equal(checkChallengeAnswer(problem, answer).correct, true, answer);
  for (const answer of ['2', '-3/2', '1.5001'])
    assert.deepEqual(
      [
        checkChallengeAnswer(problem, answer).correct,
        checkChallengeAnswer(problem, answer).valid,
      ],
      [false, true],
    );
  for (const answer of [
    '',
    'x+2=3.5',
    '2x=3',
    '3/0',
    'abc',
    'x=',
    '1; alert(1)',
  ])
    assert.equal(checkChallengeAnswer(problem, answer).valid, false, answer);
});
await test('progress restores safely and does not trust a stored correct-answer count', () => {
  assert.deepEqual(readProgress('{"level":8,"correct":500}'), {
    level: 8,
    correct: 7,
  });
  for (const value of [
    null,
    'nope',
    '{}',
    '{"level":-1}',
    '{"level":3.5}',
    '{"level":"5"}',
    '{"level":999999999}',
  ])
    assert.deepEqual(readProgress(value), { level: 1, correct: 0 });
});

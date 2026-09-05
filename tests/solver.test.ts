import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  solveEquation,
  checkStudentStep,
  Fraction,
  EquationError,
} from '../lib/solver.ts';

const examples: [string, string][] = [
  ['3(2x-5)+4=19', '5'],
  ['2x+5=17', '6'],
  ['4(x-3)=20', '8'],
  ['(x+2)/5=3', '13'],
  ['3x+5=2x+12', '7'],
  ['-2x+9=21', '-6'],
  ['0.5x+1.5=4', '5'],
  ['x/3+4=10', '18'],
  ['(x+2)/5=(3x-1)/4', '13/11'],
  ['2(x-(3-x))=10', '4'],
  ['x=5', '5'],
  ['2=3x', '2/3'],
  ['2(-x+3)=14', '-4'],
  ['-(x+3)=5', '-8'],
  ['x/-2=3', '-6'],
  ['x/(2+3)=4', '20'],
  ['3 × (2x − 5) + 4 = 19', '5'],
  ['.1x+.2=.3', '1'],
  ['4y+7=31', '6'],
  ['x + -2 = 5', '7'],
  ['2[3x-1] = 16', '3'],
  ['2.5x=1', '2/5'],
  ['x+2=2', '0'],
];
for (const [equation, expected] of examples)
  await test(`solves and verifies ${equation}`, () => {
    const result = solveEquation(equation);
    assert.equal(result.value, expected);
    assert.equal(result.result, 'unique');
    assert.equal(result.check?.valid, true);
    for (const step of result.steps) {
      const next = solveEquation(step.equation);
      assert.equal(
        next.value,
        expected,
        `Invalid transformation: ${step.equation}`,
      );
    }
  });
await test('the original brief produces exactly the four expected transformations', () => {
  assert.deepEqual(
    solveEquation('3(2x-5)+4=19').steps.map((s) => s.equation),
    ['6x - 15 + 4 = 19', '6x - 11 = 19', '6x = 30', 'x = 5'],
  );
});
await test('changing equations produces new solution data', () => {
  const a = solveEquation('2x+5=17');
  const b = solveEquation('4(x-3)=20');
  assert.notEqual(a.answer, b.answer);
  assert.notDeepEqual(a.steps, b.steps);
  assert.notEqual(a.check?.substitution, b.check?.substitution);
});
for (const equation of ['x=x', '2x+4=2(x+2)', '3=3', '0x=0', 'x-x=0'])
  await test(`identity: ${equation}`, () =>
    assert.equal(solveEquation(equation).result, 'infinite'));
for (const equation of ['x+1=x+2', '0x=2', '3=4', '2(x+2)=2x+1'])
  await test(`contradiction: ${equation}`, () =>
    assert.equal(solveEquation(equation).result, 'none'));
for (const equation of [
  '',
  '2x+5',
  'x==3',
  '=3',
  'x=',
  'x/0=2',
  'x/(2-2)=3',
  '3/x=12',
  'x^2=4',
  'sqrt(x+4)=6',
  'x+y=2',
  'x*x=4',
  '3(x+2=18',
  '3()=5',
  'x+=2',
  'x;alert(1)=5',
  '2 3x=6',
  'x..2=4',
  'x<3=4',
])
  await test(`rejects unsupported or malformed input: ${equation}`, () =>
    assert.throws(() => solveEquation(equation), EquationError));
await test('bounds long input and excessive nesting', () => {
  assert.throws(() => solveEquation('x+'.repeat(150) + '1=3'), EquationError);
  assert.throws(
    () => solveEquation('('.repeat(30) + 'x' + ')'.repeat(30) + '=3'),
    EquationError,
  );
});
await test('practice detects missed distribution and accepts alternate valid steps', () => {
  assert.equal(checkStudentStep('3(x+2)=18', '3x+2=18').correct, false);
  assert.match(checkStudentStep('3(x+2)=18', '3x+2=18').message, /every term/);
  assert.equal(checkStudentStep('3(x+2)=18', '3x+6=18').correct, true);
  assert.equal(checkStudentStep('3(x+2)=18', 'x+2=6').correct, true);
  assert.equal(checkStudentStep('3(x+2)=18', 'x=4').correct, true);
  assert.equal(checkStudentStep('3(x+2)=18', 'y=4').correct, false);
  assert.equal(checkStudentStep('3(x+2)=18', '3(x + 2) = 18').correct, false);
  assert.equal(checkStudentStep('3(x+2)=18', 'nope').correct, false);
});
await test('hundreds of generated equations preserve exact solutions at every step', () => {
  for (let a = -7; a <= 7; a++)
    for (let b = -4; b <= 4; b++)
      for (const d of [1, 3, -2]) {
        if (!a) continue;
        const expected = new Fraction(7 - b).div(new Fraction(a));
        const equation = `${d}(${a}x+${b})=${7 * d}`;
        const result = solveEquation(equation);
        assert.equal(result.value, expected.toString(), equation);
        for (const step of result.steps)
          assert.equal(
            solveEquation(step.equation).value,
            expected.toString(),
            `${equation} -> ${step.equation}`,
          );
      }
});
await test('exact fractional arithmetic does not introduce decimal rounding', () => {
  assert.equal(new Fraction(1, 3).add(new Fraction(1, 6)).toString(), '1/2');
  assert.equal(
    Fraction.parse('.1').add(Fraction.parse('.2')).toString(),
    '3/10',
  );
  assert.equal(new Fraction(2, -4).toString(), '-1/2');
});

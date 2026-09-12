/** Exact, bounded symbolic arithmetic. No eval, network, or floating-point algebra. */
export class EquationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EquationError';
  }
}
const abs = (n: bigint) => (n < 0n ? -n : n);
function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}
export class Fraction {
  readonly n: bigint;
  readonly d: bigint;
  constructor(n: bigint | number, d: bigint | number = 1n) {
    let num = BigInt(n),
      den = BigInt(d);
    if (!den)
      throw new EquationError(
        'We can’t divide by zero. Check the denominator in your equation.',
      );
    if (den < 0n) {
      num = -num;
      den = -den;
    }
    const common = gcd(abs(num), den);
    this.n = num / common;
    this.d = den / common;
    if (this.n.toString().length > 120 || this.d.toString().length > 120)
      throw new EquationError(
        'Those numbers are a little too large. Try a smaller equation.',
      );
  }
  static parse(value: string): Fraction {
    const [whole, decimal = ''] = value.split('.');
    return new Fraction(
      BigInt((whole || '0') + decimal),
      10n ** BigInt(decimal.length),
    );
  }
  add(b: Fraction) {
    return new Fraction(this.n * b.d + b.n * this.d, this.d * b.d);
  }
  sub(b: Fraction) {
    return this.add(b.neg());
  }
  mul(b: Fraction) {
    return new Fraction(this.n * b.n, this.d * b.d);
  }
  div(b: Fraction) {
    return new Fraction(this.n * b.d, this.d * b.n);
  }
  neg() {
    return new Fraction(-this.n, this.d);
  }
  abs() {
    return new Fraction(abs(this.n), this.d);
  }
  equals(b: Fraction) {
    return this.n === b.n && this.d === b.d;
  }
  get zero() {
    return this.n === 0n;
  }
  get one() {
    return this.n === this.d;
  }
  toString() {
    return this.d === 1n ? String(this.n) : `${this.n}/${this.d}`;
  }
  toNumber() {
    return Number(this.n) / Number(this.d);
  }
}
const ZERO = new Fraction(0),
  ONE = new Fraction(1);
type Node =
  | { kind: 'number'; value: Fraction }
  | { kind: 'variable'; name: string }
  | { kind: 'negate'; child: Node }
  | { kind: 'group'; child: Node }
  | { kind: 'binary'; op: string; left: Node; right: Node };
type Term = { coefficient: Fraction; variable: boolean };
type Linear = { a: Fraction; b: Fraction };
export type Step = {
  id: string;
  title: string;
  equation: string;
  explanation: string;
  why: string;
  operation?: string;
  before?: string;
  highlight: 'all' | 'constants' | 'right';
};
export type Solution = {
  input: string;
  variable: string;
  steps: Step[];
  result: 'unique' | 'none' | 'infinite';
  answer: string;
  value: string | null;
  check: { substitution: string; equality: string; valid: boolean } | null;
};

export function normalizeInput(input: string): string {
  return input
    .trim()
    .replace(/[−–—]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .toLowerCase();
}
class Parser {
  private tokens: string[] = [];
  private index = 0;
  private depth = 0;
  constructor(source: string) {
    let position = 0;
    while (position < source.length) {
      const remaining = source.slice(position);
      const whitespace = remaining.match(/^\s+/);
      if (whitespace) {
        position += whitespace[0].length;
        continue;
      }
      const match = remaining.match(
        /^(?:\d+(?:\.\d*)?|\.\d+|[a-z]+|[()+\-*/])/,
      );
      if (!match)
        throw new EquationError(
          'Use numbers, one letter, +, −, ×, /, and parentheses. For example: 3(x + 2) = 18.',
        );
      const token = match[0];
      if (/^[a-z]{2,}$/.test(token))
        throw new EquationError(
          'Algebra with Khalid solves equations, not written instructions. Try something like 2x + 5 = 17.',
        );
      if (/^[\d.]/.test(token) && token.length > 24)
        throw new EquationError(
          'Please use numbers with no more than 24 digits.',
        );
      this.tokens.push(token);
      position += token.length;
    }
    if (this.tokens.length > 160)
      throw new EquationError(
        'That equation is too long. Try one with fewer terms.',
      );
  }
  private peek() {
    return this.tokens[this.index];
  }
  parse(): Node {
    if (!this.tokens.length)
      throw new EquationError(
        'Both sides of your equation need a value. Try x + 5 = 12.',
      );
    const node = this.expression();
    if (this.index !== this.tokens.length)
      throw new EquationError(
        'Something doesn’t quite match. Check your parentheses and operators.',
      );
    return node;
  }
  private expression(): Node {
    let node = this.term();
    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.tokens[this.index++];
      node = { kind: 'binary', op, left: node, right: this.term() };
    }
    return node;
  }
  private term(): Node {
    let node = this.atom();
    while (this.peek()) {
      const token = this.peek();
      if (token === '*' || token === '/') {
        this.index++;
        node = { kind: 'binary', op: token, left: node, right: this.atom() };
      } else if (token === '(' || /^[a-z]$/.test(token)) {
        node = { kind: 'binary', op: '*', left: node, right: this.atom() };
      } else break;
    }
    return node;
  }
  private atom(): Node {
    if (++this.depth > 24)
      throw new EquationError(
        'There are too many nested parentheses. Try a simpler equation.',
      );
    const token = this.tokens[this.index++];
    let node: Node;
    if (token === '-' || token === '+') {
      const child = this.atom();
      node = token === '-' ? { kind: 'negate', child } : child;
    } else if (token === '(') {
      const child = this.expression();
      if (this.tokens[this.index++] !== ')')
        throw new EquationError(
          'There’s a missing closing parenthesis. Make sure each ( has a matching ).',
        );
      node = { kind: 'group', child };
    } else if (token && /^[a-z]$/.test(token))
      node = { kind: 'variable', name: token };
    else if (token && /^(\d+(\.\d*)?|\.\d+)$/.test(token))
      node = { kind: 'number', value: Fraction.parse(token) };
    else
      throw new EquationError(
        'A number or variable is missing. Check for an extra operator or empty parentheses.',
      );
    this.depth--;
    return node;
  }
}
function containsVariable(node: Node): boolean {
  if (node.kind === 'variable') return true;
  if (node.kind === 'number') return false;
  if (node.kind !== 'binary') return containsVariable(node.child);
  return containsVariable(node.left) || containsVariable(node.right);
}
function total(terms: Term[]): Linear {
  return terms.reduce(
    (sum, term) =>
      term.variable
        ? { ...sum, a: sum.a.add(term.coefficient) }
        : { ...sum, b: sum.b.add(term.coefficient) },
    { a: ZERO, b: ZERO },
  );
}
function expand(node: Node): Term[] {
  if (node.kind === 'number')
    return [{ coefficient: node.value, variable: false }];
  if (node.kind === 'variable') return [{ coefficient: ONE, variable: true }];
  if (node.kind === 'group') return expand(node.child);
  if (node.kind === 'negate')
    return expand(node.child).map((t) => ({
      ...t,
      coefficient: t.coefficient.neg(),
    }));
  const left = expand(node.left),
    right = expand(node.right);
  let terms: Term[];
  if (node.op === '+' || node.op === '-')
    terms = [
      ...left,
      ...right.map((t) => ({
        ...t,
        coefficient: node.op === '-' ? t.coefficient.neg() : t.coefficient,
      })),
    ];
  else if (node.op === '/') {
    if (containsVariable(node.right))
      throw new EquationError(
        'Variables in denominators aren’t supported yet. Try a linear fraction such as (x + 2)/5 = 3.',
      );
    const denominator = total(right).b;
    terms = left.map((t) => ({
      ...t,
      coefficient: t.coefficient.div(denominator),
    }));
  } else {
    if (containsVariable(node.left) && containsVariable(node.right))
      throw new EquationError(
        'This version solves linear equations. Multiplying variables creates a higher power; try 3(x + 2) = 18.',
      );
    if (left.length * right.length > 128)
      throw new EquationError(
        'That expression expands to too many terms. Try a simpler equation.',
      );
    terms = left.flatMap((a) =>
      right.map((b) => ({
        coefficient: a.coefficient.mul(b.coefficient),
        variable: a.variable || b.variable,
      })),
    );
  }
  if (terms.length > 128)
    throw new EquationError(
      'That expression expands to too many terms. Try a simpler equation.',
    );
  return terms;
}
function hasDistribution(node: Node): boolean {
  if (node.kind === 'number' || node.kind === 'variable') return false;
  if (node.kind !== 'binary')
    return (
      (node.kind === 'negate' && expand(node.child).length > 1) ||
      hasDistribution(node.child)
    );
  return (
    ((node.op === '*' || node.op === '/') &&
      (expand(node.left).length > 1 || expand(node.right).length > 1)) ||
    hasDistribution(node.left) ||
    hasDistribution(node.right)
  );
}
function formatTerms(terms: Term[], variable: string): string {
  const active = terms.filter((t) => !t.coefficient.zero);
  if (!active.length) return '0';
  return active
    .map((term, i) => {
      const positive = term.coefficient.abs();
      const value = term.variable
        ? positive.one
          ? variable
          : `${positive.d === 1n ? positive.toString() : `(${positive.toString()})`}${variable}`
        : String(positive);
      const sign =
        term.coefficient.n < 0n
          ? i === 0
            ? '-'
            : ' - '
          : i === 0
            ? ''
            : ' + ';
      return sign + value;
    })
    .join('');
}
function formatLinear(value: Linear, variable: string) {
  return formatTerms(
    [
      { coefficient: value.a, variable: true },
      { coefficient: value.b, variable: false },
    ],
    variable,
  );
}
function equationOf(left: Linear, right: Linear, variable: string) {
  return `${formatLinear(left, variable)} = ${formatLinear(right, variable)}`;
}
function prettyInput(input: string) {
  return input
    .replace(/\s+/g, '')
    .replace(/([+=])/g, ' $1 ')
    .replace(/-/g, ' - ')
    .replace(/\*/g, ' × ')
    .trim()
    .replace(/\( - /g, '(-');
}
function evaluate(node: Node, value: Fraction): Fraction {
  if (node.kind === 'number') return node.value;
  if (node.kind === 'variable') return value;
  if (node.kind === 'group') return evaluate(node.child, value);
  if (node.kind === 'negate') return evaluate(node.child, value).neg();
  const a = evaluate(node.left, value),
    b = evaluate(node.right, value);
  if (node.op === '+') return a.add(b);
  if (node.op === '-') return a.sub(b);
  if (node.op === '*') return a.mul(b);
  return a.div(b);
}
function parseEquation(raw: string) {
  if (typeof raw !== 'string' || !raw.trim())
    throw new EquationError('Start with an equation, like 2x + 5 = 17.');
  if (raw.length > 240)
    throw new EquationError('Keep your equation under 240 characters.');
  const input = normalizeInput(raw);
  if ((input.match(/=/g) || []).length !== 1)
    throw new EquationError(
      'Algebra with Khalid only solves equations. Include one equals sign, like 2x + 5 = 17.',
    );
  if (/[\^√]/.test(input) || /sqrt/.test(input))
    throw new EquationError(
      'Powers and square roots are coming later. For now, try a one-variable linear equation like 4x + 7 = 31.',
    );
  const variables = [...new Set(input.match(/[a-z]/g))];
  if (variables.length > 1)
    throw new EquationError(
      'Let’s work with one variable at a time. Try an equation using just x, like 3x + 5 = 2x + 12.',
    );
  const variable = variables[0] || 'x';
  const [lhs, rhs] = input.split('=');
  const left = new Parser(lhs).parse(),
    right = new Parser(rhs).parse();
  return { input, variable, left, right };
}
/** Reuse the exact linear parser without changing equation-solving behavior. */
export function linearRelation(raw: string) {
  const { variable, left, right } = parseEquation(raw);
  return { variable, left: total(expand(left)), right: total(expand(right)) };
}

export function solveEquation(raw: string): Solution {
  const {
    input,
    variable,
    left: leftNode,
    right: rightNode,
  } = parseEquation(raw);
  const leftTerms = expand(leftNode),
    rightTerms = expand(rightNode);
  let left = total(leftTerms),
    right = total(rightTerms);
  const steps: Step[] = [];
  let before = prettyInput(input);
  const add = (step: Omit<Step, 'id' | 'before'>) => {
    steps.push({ ...step, before, id: `step-${steps.length + 1}` });
    before = step.equation;
  };
  const expanded = `${formatTerms(leftTerms, variable)} = ${formatTerms(rightTerms, variable)}`;
  const combined = equationOf(left, right, variable);
  const distributed = hasDistribution(leftNode) || hasDistribution(rightNode);
  if (distributed) {
    add({
      title: 'Distribute across the parentheses',
      equation: expanded,
      explanation:
        'Multiply or divide every term inside the parentheses by the outside factor.',
      why: 'The distributive property says a(b + c) = ab + ac. The outside factor applies to every term, including negative terms. For division, distribute multiplication by the reciprocal.',
      highlight: 'all',
    });
  }
  const stripped = (s: string) => s.replace(/[\s×*]/g, '');
  if (
    expanded !== combined ||
    (!distributed && stripped(before) !== stripped(combined))
  ) {
    add({
      title: 'Combine like terms',
      equation: combined,
      explanation:
        'Add the variable terms together, then add the constants on each side.',
      why: `Like terms have the same variable part. For example, 3${variable} + 2${variable} = 5${variable}. Constants can also be added together. Keep terms on their own side of the equals sign at this stage.`,
      highlight: 'all',
    });
  }
  if (!right.a.zero) {
    const amount = right.a;
    const label = formatTerms(
      [{ coefficient: amount.abs(), variable: true }],
      variable,
    );
    left = { ...left, a: left.a.sub(amount) };
    right = { ...right, a: ZERO };
    const action = amount.n < 0n ? 'Add' : 'Subtract';
    add({
      title: `${action} ${label} ${action === 'Add' ? 'to' : 'from'} both sides`,
      equation: equationOf(left, right, variable),
      explanation: `Bring all the ${variable} terms to the left while keeping both sides equal.`,
      why: `We want the variable on one side. ${action === 'Add' ? 'Adding' : 'Subtracting'} the same variable term on both sides cancels it on the right without changing the solutions.`,
      operation: `${amount.n < 0n ? '+' : '-'} ${label}`,
      highlight: 'all',
    });
  }
  if (!left.b.zero) {
    const amount = left.b;
    left = { ...left, b: ZERO };
    right = { ...right, b: right.b.sub(amount) };
    const action = amount.n < 0n ? 'Add' : 'Subtract';
    add({
      title: `${action} ${String(amount.abs())} ${action === 'Add' ? 'to' : 'from'} both sides`,
      equation: equationOf(left, right, variable),
      explanation:
        'Undo the constant on the left. Apply the same operation to the right.',
      why: `Our goal is to isolate ${variable}. Addition and subtraction undo each other. ${action === 'Add' ? 'Adding' : 'Subtracting'} ${String(amount.abs())} on both sides keeps the equation balanced and leaves only the variable term on the left.`,
      operation: `${amount.n < 0n ? '+' : '-'} ${String(amount.abs())}`,
      highlight: 'right',
    });
  }
  if (left.a.zero) {
    const infinite = right.b.zero;
    add({
      title: infinite
        ? 'Recognize a true statement'
        : 'Recognize a contradiction',
      equation: equationOf(left, right, variable),
      explanation: infinite
        ? 'Both sides are equal regardless of the value of the variable.'
        : 'These constants are unequal, so no value of the variable can make the original equation true.',
      why: infinite
        ? 'The variable terms canceled and left an identity. Every real number satisfies this equation.'
        : 'The variable terms canceled and left a false statement. Changing the variable cannot fix that contradiction.',
      highlight: 'all',
    });
    return {
      input: prettyInput(input),
      variable,
      steps,
      result: infinite ? 'infinite' : 'none',
      answer: infinite ? 'All real numbers' : 'No solution',
      value: null,
      check: null,
    };
  }
  const value = right.b.div(left.a);
  if (!left.a.one) {
    add({
      title: `Divide both sides by ${String(left.a)}`,
      equation: `${variable} = ${String(value)}`,
      explanation: `Divide out the coefficient of ${variable} to leave the variable on its own.`,
      why: `${variable} is multiplied by ${String(left.a)}, so we undo that multiplication with division. Dividing both sides by the same nonzero number keeps the equation balanced.`,
      operation: `÷ ${String(left.a)}`,
      highlight: 'right',
    });
  }
  if (!steps.length)
    add({
      title: 'The variable is already isolated',
      equation: `${variable} = ${String(value)}`,
      explanation: `There’s nothing left to undo. The value of ${variable} is already clear.`,
      why: 'An isolated variable has a coefficient of 1 and no added constant. You can read its value from the other side.',
      highlight: 'right',
    });
  const checkLeft = evaluate(leftNode, value),
    checkRight = evaluate(rightNode, value);
  if (!checkLeft.equals(checkRight))
    throw new EquationError(
      'We couldn’t verify this solution. Please check your equation.',
    );
  return {
    input: prettyInput(input),
    variable,
    steps,
    result: 'unique',
    answer: `${variable} = ${String(value)}`,
    value: String(value),
    check: {
      substitution: prettyInput(input).replace(
        new RegExp(variable, 'g'),
        `(${String(value)})`,
      ),
      equality: `${String(checkLeft)} = ${String(checkRight)}`,
      valid: true,
    },
  };
}

/** Compare complete solution sets, allowing any valid equivalent next step. */
export function checkStudentStep(
  original: string,
  candidate: string,
): { correct: boolean; message: string } {
  const expected = solveEquation(original);
  let proposed: Solution;
  try {
    proposed = solveEquation(candidate);
  } catch (error) {
    return {
      correct: false,
      message:
        error instanceof Error
          ? error.message
          : 'Check your equation and try again.',
    };
  }
  if (
    normalizeInput(original).replace(/\s/g, '') ===
    normalizeInput(candidate).replace(/\s/g, '')
  )
    return {
      correct: false,
      message:
        'That’s the starting equation. Try applying an operation to take one step forward.',
    };
  if (expected.variable !== proposed.variable && /[a-z]/i.test(candidate))
    return {
      correct: false,
      message: `Keep using ${expected.variable}, the variable in your starting equation.`,
    };
  if (expected.result === proposed.result && expected.value === proposed.value)
    return {
      correct: true,
      message:
        'Exactly. Your equation has the same solution, so that’s a valid step. Keep going!',
    };
  const first = expected.steps[0];
  if (first.title.includes('Distribute'))
    return {
      correct: false,
      message: `Almost. The outside factor needs to apply to every term inside the parentheses. A correct next step is ${first.equation}.`,
    };
  return {
    correct: false,
    message:
      'Not quite. This changes the solution. Check your arithmetic and make sure you apply the same operation to both sides.',
  };
}

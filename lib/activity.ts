import { normalizeInput, solveEquation, checkStudentStep } from './solver.ts';
import type { QuestionTopic } from './school.ts';

/** Shared by the browser and Edge Function; grading happens again on the server. */
export function classifyQuestion(raw: string): QuestionTopic {
  if (/[<>≤≥]/.test(raw)) return 'Inequalities';
  try {
    const solved = solveEquation(raw);
    if (solved.result === 'none') return 'No solution';
    if (solved.result === 'infinite') return 'All real numbers';
    const input = normalizeInput(raw);
    const [left, right] = input.split('=');
    if (input.includes('/')) return 'Fractions';
    if (/[a-z]/i.test(left) && /[a-z]/i.test(right)) return 'Variables on both sides';
    if (/[()]/.test(input)) return 'Parentheses';
    if (/\d\.\d|\.\d/.test(input)) return 'Decimals';
    if (/(?:^|[=(+*/])\s*-/.test(input)) return 'Negative numbers';
    return solved.steps.length > 1 ? 'Two-step equations' : 'One-step equations';
  } catch { return 'Unsupported input'; }
}

export function evaluateActivity(kind: 'solve' | 'practice', equation: string, answer?: string) {
  if (!equation.trim() || equation.length > 240) throw new Error('Enter an equation of up to 240 characters.');
  if (answer !== undefined && answer.length > 240) throw new Error('The answer is too long.');
  const topic = classifyQuestion(equation);
  // Inequality views are recorded, without treating them as graded equation answers.
  if (kind === 'solve' && topic === 'Inequalities') return { topic, correct: null, result: 'viewed' };
  if (kind === 'practice') {
    const result = checkStudentStep(equation, answer ?? '');
    return { topic, correct: result.correct, result: result.correct ? 'correct' : 'try_again' };
  }
  try {
    const solved = solveEquation(equation);
    return { topic, correct: null, result: solved.result };
  } catch { return { topic, correct: null, result: 'unsupported' }; }
}

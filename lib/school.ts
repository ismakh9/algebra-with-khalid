export const SCHOOL_DOMAIN = 'abaarsoschool.org';
export const TEACHER_EMAIL = 'kismail@abaarsoschool.org';

export function schoolEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@abaarsoschool\.org$/.test(email)) return null;
  if (email.split('@')[0].includes('..')) return null;
  return email;
}

export const QUESTION_TOPICS = [
  'One-step equations', 'Two-step equations', 'Parentheses', 'Variables on both sides',
  'Fractions', 'Decimals', 'Negative numbers', 'No solution', 'All real numbers', 'Unsupported input',
] as const;
export type QuestionTopic = typeof QUESTION_TOPICS[number];
export type ActivityKind = 'solve' | 'practice' | 'challenge_view' | 'challenge_answer';

export type Account = {
  id: string; email: string; role: 'student' | 'teacher'; level: number; correct: number;
};
export type ActivityRow = {
  id: number; email: string; kind: ActivityKind; equation: string;
  topic: string; answer: string | null; correct: boolean | null;
  result: string; level: number | null; created_at: string;
};
export type StudentRow = {
  id: string; email: string; joined_at: string; last_login: string | null;
  logins: number; questions: number; attempts: number; correct: number; level: number;
};
export type TeacherDashboard = {
  summary: { students: number; logins: number; questions: number; attempts: number; correct: number };
  students: StudentRow[];
  topics: { topic: string; count: number }[];
  logins: { email: string; created_at: string }[];
  activities: ActivityRow[];
  total: number;
};

export function pageUrl(route: '/' | '/login' | '/dashboard' | '/challenge', basePath = '') {
  return `${basePath}${route === '/' ? '/' : `${route}${basePath ? '.html' : ''}`}`;
}

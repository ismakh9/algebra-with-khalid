export const dynamic = 'force-static';
import type { Metadata } from 'next';
import { SchoolGate } from '@/components/school-auth';
import Inequalities from './inequalities';
import './inequalities.css';
export const metadata: Metadata = {
  title: 'Inequalities — Algebra with Khalid',
  description: 'Solve linear inequalities with clear steps, exact interval notation, and number-line graphs.',
};
export default function InequalitiesPage() {
  return <SchoolGate><Inequalities /></SchoolGate>;
}

import { SchoolGate } from '@/components/school-auth';
import Dashboard from './dashboard';
export const dynamic = 'force-static';
export const metadata = { title: 'Teacher dashboard — Algebra with Khalid', robots: { index: false, follow: false } };
export default function DashboardPage() { return <SchoolGate teacher><Dashboard /></SchoolGate>; }

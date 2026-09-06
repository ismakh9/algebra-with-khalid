import Solver from './solver';
import { SchoolGate } from '@/components/school-auth';

export const dynamic = 'force-static';

export default function Page() {
  return <SchoolGate><Solver /></SchoolGate>;
}

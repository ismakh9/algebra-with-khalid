export const dynamic = 'force-static';

import type { Metadata } from 'next';
import Challenge from './challenge';

export const metadata: Metadata = {
  title: 'Challenge — Algebra with Khalid',
  description:
    'Build your algebra confidence with random equations that get harder each time you answer correctly.',
};
export default function ChallengePage() {
  return <Challenge />;
}

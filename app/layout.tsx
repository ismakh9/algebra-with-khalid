import type { Metadata } from 'next';
import './globals.css';
import './school.css';
import { SchoolAuthProvider } from '@/components/school-auth';

export const metadata: Metadata = {
  title: 'Algebra with Khalid — Every step, explained',
  description:
    'Algebra learning for Abaarso School, with clear steps, adaptive challenges, and teacher support.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><SchoolAuthProvider>{children}</SchoolAuthProvider></body>
    </html>
  );
}

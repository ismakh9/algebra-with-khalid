import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Algebra with Khalid — Every step, explained',
  description:
    'Make the math make sense. Solve one-variable linear equations with clear steps, helpful explanations, and answer verification. Free, private, and locally runnable.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

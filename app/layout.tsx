import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Figure8 Results',
  description: 'SEO Platform Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

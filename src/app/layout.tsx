import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Pixig — AI product creatives that convert',
  description:
    'Turn boring product images into high-converting Instagram creatives. Studio shots, lifestyle scenes, and ad posters in seconds.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'Pixig — AI product creatives that convert',
    description: 'Turn boring product images into high-converting Instagram creatives.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans min-h-screen">{children}</body>
    </html>
  );
}

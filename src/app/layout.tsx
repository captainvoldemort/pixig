import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

function safeUrl(raw: string | undefined): URL {
  const fallback = new URL('http://localhost:3000');
  if (!raw) return fallback;
  try {
    return new URL(raw);
  } catch {
    return fallback;
  }
}

export const metadata: Metadata = {
  title: 'Pixig — AI product creatives that convert',
  description:
    'Turn boring product images into high-converting Instagram creatives. Studio shots, lifestyle scenes, and ad posters in seconds.',
  metadataBase: safeUrl(process.env.NEXT_PUBLIC_APP_URL),
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

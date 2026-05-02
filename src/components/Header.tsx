'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Logo } from './Logo';
import { LogOut, LayoutDashboard } from 'lucide-react';

export function Header({ variant = 'public' }: { variant?: 'public' | 'app' }) {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    const sb = createClient();
    await sb.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-bg/70 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-2">
          {email ? (
            <>
              {variant === 'public' && (
                <Link href="/dashboard" className="btn-ghost text-sm">
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </Link>
              )}
              <span className="hidden sm:inline text-xs text-zinc-500 px-2">{email}</span>
              <button onClick={signOut} className="btn-ghost text-sm" aria-label="Sign out">
                <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign out</span>
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost text-sm">
                Login
              </Link>
              <Link href="/signup" className="btn-primary text-sm">
                Start free
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

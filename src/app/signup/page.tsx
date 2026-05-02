'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Logo } from '@/components/Logo';
import { Loader2 } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setInfo(null);
    const sb = createClient();
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (data.session) {
      router.push('/dashboard');
      router.refresh();
    } else {
      setInfo('Check your inbox to confirm your email, then sign in.');
    }
  }

  return (
    <div className="min-h-screen grid place-items-center hero-gradient px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo className="text-xl" />
        </div>
        <div className="card p-8">
          <h1 className="text-2xl font-bold mb-1">Create your account</h1>
          <p className="text-sm text-zinc-400 mb-6">
            Free to start. Generate your first creative in 60s.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@brand.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </div>
            {err && (
              <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                {err}
              </div>
            )}
            {info && (
              <div className="text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                {info}
              </div>
            )}
            <button className="btn-primary w-full" disabled={loading} type="submit">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Create account
            </button>
          </form>
          <p className="mt-6 text-sm text-zinc-400 text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-300 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
        <p className="mt-6 text-xs text-zinc-500 text-center">
          <Link href="/" className="hover:text-zinc-300">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}

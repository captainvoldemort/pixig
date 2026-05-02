import Link from 'next/link';
import { Header } from '@/components/Header';
import {
  ArrowRight,
  Image as ImageIcon,
  Sparkles,
  Layout,
  Zap,
  Wand2,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Header variant="public" />

      {/* HERO */}
      <section className="relative overflow-hidden hero-gradient">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 mb-6">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            Powered by Gemini 2.5 — text + image
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] max-w-4xl mx-auto">
            Turn boring product images <br />
            into{' '}
            <span className="bg-gradient-to-r from-brand-400 via-pink-400 to-sky-400 bg-clip-text text-transparent">
              high-converting creatives.
            </span>
          </h1>
          <p className="mt-6 text-lg text-zinc-400 max-w-2xl mx-auto">
            Drop a product photo + description. Pixig diagnoses what's wrong, then ships an
            Instagram-ready studio shot, lifestyle scene, and ad poster — with hooks and captions
            that actually stop the scroll.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary text-base px-6 py-3">
              Start generating <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="#how" className="btn-ghost text-base px-6 py-3">
              See how it works
            </Link>
          </div>
        </div>

        {/* DEMO PREVIEW */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-24">
          <div className="glass rounded-3xl p-3 sm:p-6">
            <div className="grid md:grid-cols-3 gap-4">
              <DemoCard
                badge="Studio"
                hook="Carry less. Stand out more."
                gradient="from-zinc-800 via-zinc-900 to-black"
              />
              <DemoCard
                badge="Lifestyle"
                hook="Made for the mornings that matter."
                gradient="from-amber-900/40 via-rose-900/30 to-zinc-900"
              />
              <DemoCard
                badge="Poster"
                hook="The only one you'll ever need."
                gradient="from-brand-700 via-fuchsia-700 to-sky-700"
              />
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="max-w-6xl mx-auto px-4 sm:px-6 py-24">
        <h2 className="text-3xl sm:text-4xl font-bold text-center mb-3">From product → post in 60s</h2>
        <p className="text-zinc-400 text-center max-w-2xl mx-auto mb-16">
          One generation produces a diagnosis and three Instagram-ready creatives. Every regenerate
          is saved as a version — nothing is ever lost.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <Step
            n={1}
            icon={<ImageIcon className="w-5 h-5" />}
            title="Upload your product"
            body="Drop a photo and a short product description. That's it."
          />
          <Step
            n={2}
            icon={<Wand2 className="w-5 h-5" />}
            title="Diagnose + plan"
            body="Pixig spots what's holding the image back — lighting, context, emotion — and writes the briefs."
          />
          <Step
            n={3}
            icon={<Layout className="w-5 h-5" />}
            title="Three IG-ready creatives"
            body="Studio, lifestyle, poster. Each with a hook, caption, and the reasoning behind it."
          />
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-24 border-t border-white/5">
        <div className="grid md:grid-cols-2 gap-6">
          <Feature
            icon={<Zap className="w-5 h-5" />}
            title="Versioned generations"
            body="Every regenerate creates a new version. Old outputs are never overwritten — A/B them, ship the winner."
          />
          <Feature
            icon={<Sparkles className="w-5 h-5" />}
            title="Hook + caption + reasoning"
            body="We don't hand you a pretty image and walk away. Each creative ships with copy and the why behind it."
          />
          <Feature
            icon={<Layout className="w-5 h-5" />}
            title="Three angles, one click"
            body="Studio shot for marketplaces, lifestyle for organic, poster for paid. One generate, three formats."
          />
          <Feature
            icon={<Wand2 className="w-5 h-5" />}
            title="Diagnostic-first"
            body="Pixig tells you what's wrong with your current visuals before generating new ones."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-24 text-center">
        <h2 className="text-4xl font-bold mb-4">Your next-best creative is one prompt away.</h2>
        <p className="text-zinc-400 mb-8">Free to try. Bring your product, leave with a campaign.</p>
        <Link href="/signup" className="btn-primary text-base px-6 py-3">
          Create your first project <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} Pixig.ai · Built with Next.js, Supabase, Gemini & Cloudinary
      </footer>
    </div>
  );
}

function DemoCard({
  badge,
  hook,
  gradient,
}: {
  badge: string;
  hook: string;
  gradient: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-2 border-b border-white/5">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-500 to-pink-500" />
        <span className="text-xs font-medium">yourbrand</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-brand-300 bg-brand-500/15 px-2 py-0.5 rounded">
          {badge}
        </span>
      </div>
      <div className={`relative aspect-square bg-gradient-to-br ${gradient} flex items-center justify-center p-6`}>
        <p className="text-white text-xl font-bold text-center leading-tight drop-shadow-lg">
          {hook}
        </p>
      </div>
      <div className="px-3 py-2 flex items-center gap-3 text-zinc-400">
        <Heart className="w-4 h-4" />
        <MessageCircle className="w-4 h-4" />
        <Send className="w-4 h-4" />
        <Bookmark className="w-4 h-4 ml-auto" />
      </div>
      <div className="px-3 pb-3 text-xs text-zinc-300 leading-relaxed">
        <span className="font-semibold mr-1">yourbrand</span>
        AI-generated caption with a real hook, a real story, and the right hashtags. #pixig
      </div>
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  body,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-brand-500/15 text-brand-300 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-xs text-zinc-500 font-mono">STEP {n}</span>
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-zinc-400">{body}</p>
    </div>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="card p-6 hover:border-brand-500/30 transition">
      <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center mb-3">
        {icon}
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-zinc-400">{body}</p>
    </div>
  );
}

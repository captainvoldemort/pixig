'use client';

import { useState } from 'react';
import type { Output } from '@/lib/types';
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Lightbulb,
  Download,
  Check,
} from 'lucide-react';

const TYPE_BADGE: Record<Output['type'], { label: string; tone: string }> = {
  studio: { label: 'Studio', tone: 'bg-zinc-500/20 text-zinc-200' },
  lifestyle: { label: 'Lifestyle', tone: 'bg-amber-500/20 text-amber-200' },
  poster: { label: 'Poster', tone: 'bg-brand-500/20 text-brand-200' },
};

export function InstagramCard({
  output,
  username,
}: {
  output: Output;
  username: string;
}) {
  const [showReason, setShowReason] = useState(false);
  const [copied, setCopied] = useState(false);
  const handle = (username || 'yourbrand').toLowerCase().replace(/\s+/g, '_').slice(0, 24);

  function copyCaption() {
    navigator.clipboard.writeText(output.caption || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <article className="card overflow-hidden flex flex-col">
      {/* IG header */}
      <header className="flex items-center gap-2.5 px-3 py-2 border-b border-white/5">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 via-pink-500 to-amber-400 p-[2px]">
          <div className="w-full h-full rounded-full bg-bg grid place-items-center text-[10px] font-bold">
            {handle.slice(0, 1).toUpperCase()}
          </div>
        </div>
        <div className="text-sm font-semibold truncate">{handle}</div>
        <span className={`ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${TYPE_BADGE[output.type].tone}`}>
          {TYPE_BADGE[output.type].label}
        </span>
        <MoreHorizontal className="w-4 h-4 text-zinc-500" />
      </header>

      {/* IG image with hook overlay */}
      <div className="relative aspect-square bg-bg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={output.image_url}
          alt={output.hook}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {output.type === 'poster' && output.hook && (
          <div className="absolute inset-0 flex items-end p-4 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none">
            <h3 className="text-white text-xl font-bold leading-tight drop-shadow-md">
              {output.hook}
            </h3>
          </div>
        )}
        <a
          href={output.image_url}
          target="_blank"
          rel="noreferrer"
          className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 hover:bg-black border border-white/10 transition"
          title="Open full size"
        >
          <Download className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* IG action row */}
      <div className="px-3 pt-3 flex items-center gap-4 text-zinc-300">
        <Heart className="w-5 h-5 hover:text-rose-400 cursor-pointer transition" />
        <MessageCircle className="w-5 h-5 cursor-pointer hover:text-zinc-100 transition" />
        <Send className="w-5 h-5 cursor-pointer hover:text-zinc-100 transition" />
        <Bookmark className="w-5 h-5 ml-auto cursor-pointer hover:text-zinc-100 transition" />
      </div>

      {/* Likes + hook */}
      <div className="px-3 pt-2 text-sm">
        <div className="text-xs text-zinc-400 mb-1">
          <span className="font-semibold text-zinc-200">2,184</span> likes
        </div>
        {output.type !== 'poster' && (
          <h3 className="font-bold text-base leading-snug mb-1">{output.hook}</h3>
        )}
      </div>

      {/* Caption */}
      <div className="px-3 pb-3 text-sm text-zinc-200 leading-relaxed">
        <span className="font-semibold mr-1.5">{handle}</span>
        <span className="whitespace-pre-wrap">{output.caption}</span>
      </div>

      {/* Reasoning toggle */}
      <div className="border-t border-white/5 px-3 py-2 mt-auto flex items-center gap-2">
        <button
          onClick={() => setShowReason((s) => !s)}
          className="text-xs text-brand-300 hover:text-brand-200 inline-flex items-center gap-1.5"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          {showReason ? 'Hide reasoning' : 'Why it works'}
        </button>
        <button
          onClick={copyCaption}
          className="ml-auto text-xs text-zinc-400 hover:text-zinc-100 inline-flex items-center gap-1.5"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" /> Copied
            </>
          ) : (
            'Copy caption'
          )}
        </button>
      </div>
      {showReason && (
        <div className="px-3 pb-3 text-xs text-zinc-400 leading-relaxed bg-white/[0.02]">
          {output.reasoning}
        </div>
      )}
    </article>
  );
}

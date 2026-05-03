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
  Sparkles,
  Copy,
  ExternalLink,
} from 'lucide-react';

const TYPE_BADGE: Record<Output['type'], { label: string; tone: string; gradient: string }> = {
  studio:    { label: 'Studio',    tone: 'bg-zinc-500/20 text-zinc-200',   gradient: 'from-zinc-700 via-zinc-800 to-black' },
  lifestyle: { label: 'Lifestyle', tone: 'bg-amber-500/20 text-amber-200', gradient: 'from-amber-900/40 via-rose-900/30 to-zinc-900' },
  poster:    { label: 'Poster',    tone: 'bg-brand-500/20 text-brand-200', gradient: 'from-brand-700 via-fuchsia-700 to-sky-700' },
};

export function InstagramCard({
  output,
  username,
}: {
  output: Output;
  username: string;
}) {
  const [showReason, setShowReason] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const handle = (username || 'yourbrand').toLowerCase().replace(/\s+/g, '_').slice(0, 24);
  const hasImage = !!output.image_url;

  function copy(text: string, setter: (b: boolean) => void) {
    navigator.clipboard.writeText(text || '');
    setter(true);
    setTimeout(() => setter(false), 1500);
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

      {/* Image OR text-only prompt preview */}
      {hasImage ? (
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
      ) : (
        <PromptPreview
          output={output}
          gradient={TYPE_BADGE[output.type].gradient}
          copiedPrompt={copiedPrompt}
          onCopy={() => copy(output.image_prompt, setCopiedPrompt)}
        />
      )}

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
        {(output.type !== 'poster' || !hasImage) && (
          <h3 className="font-bold text-base leading-snug mb-1">{output.hook}</h3>
        )}
      </div>

      {/* Caption */}
      <div className="px-3 pb-3 text-sm text-zinc-200 leading-relaxed">
        <span className="font-semibold mr-1.5">{handle}</span>
        <span className="whitespace-pre-wrap">{output.caption}</span>
      </div>

      {/* Footer toolbar */}
      <div className="border-t border-white/5 px-3 py-2 mt-auto flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setShowReason((s) => !s)}
          className="text-xs text-brand-300 hover:text-brand-200 inline-flex items-center gap-1.5"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          {showReason ? 'Hide reasoning' : 'Why it works'}
        </button>
        {!hasImage && output.image_prompt && (
          <button
            onClick={() => copy(output.image_prompt, setCopiedPrompt)}
            className="text-xs text-zinc-300 hover:text-zinc-100 inline-flex items-center gap-1.5"
          >
            {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedPrompt ? 'Copied' : 'Copy prompt'}
          </button>
        )}
        <button
          onClick={() => copy(output.caption, setCopiedCaption)}
          className="ml-auto text-xs text-zinc-400 hover:text-zinc-100 inline-flex items-center gap-1.5"
        >
          {copiedCaption ? (
            <>
              <Check className="w-3.5 h-3.5" /> Copied
            </>
          ) : (
            'Copy caption'
          )}
        </button>
      </div>
      {showReason && (
        <div className="px-3 pb-3 pt-2 text-xs text-zinc-400 leading-relaxed bg-white/[0.02]">
          {output.reasoning}
        </div>
      )}
    </article>
  );
}

function PromptPreview({
  output,
  gradient,
  copiedPrompt,
  onCopy,
}: {
  output: Output;
  gradient: string;
  copiedPrompt: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      className={`relative aspect-square bg-gradient-to-br ${gradient} flex flex-col`}
    >
      {/* faint sparkles overlay */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 35%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.12), transparent 40%)',
        }}
      />
      <div className="relative flex items-center gap-2 px-4 pt-4 pb-2">
        <Sparkles className="w-4 h-4 text-white/90" />
        <span className="text-[11px] uppercase tracking-wider text-white/80 font-medium">
          Image prompt
        </span>
      </div>
      <div className="relative flex-1 px-4 pb-4 overflow-y-auto">
        <p className="text-[12.5px] text-white/95 leading-relaxed font-mono whitespace-pre-wrap">
          {output.image_prompt}
        </p>
      </div>
      <div className="relative flex items-center gap-2 px-3 pb-3">
        <button
          onClick={onCopy}
          className="text-xs px-2.5 py-1.5 rounded-md bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 text-white inline-flex items-center gap-1.5 transition"
        >
          {copiedPrompt ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copiedPrompt ? 'Copied' : 'Copy prompt'}
        </button>
        <a
          href="https://aistudio.google.com/"
          target="_blank"
          rel="noreferrer"
          className="text-xs px-2.5 py-1.5 rounded-md bg-black/30 hover:bg-black/50 border border-white/15 text-white inline-flex items-center gap-1.5 transition"
          title="Open Google AI Studio in a new tab"
        >
          <ExternalLink className="w-3.5 h-3.5" /> AI Studio
        </a>
      </div>
    </div>
  );
}

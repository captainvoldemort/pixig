'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Project, VersionWithOutputs } from '@/lib/types';
import { LeftPanel } from './LeftPanel';
import { VersionTabs } from './VersionTabs';
import { InstagramCard } from './InstagramCard';
import { DiagnosisPanel } from './DiagnosisPanel';
import { ChevronLeft, Sparkles } from 'lucide-react';

export function ProjectWorkspace({
  project,
  initialVersions,
}: {
  project: Project;
  initialVersions: VersionWithOutputs[];
}) {
  const router = useRouter();
  const [versions, setVersions] = useState<VersionWithOutputs[]>(initialVersions);
  const [activeIdx, setActiveIdx] = useState(initialVersions.length - 1);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(project.image_url);
  const [description, setDescription] = useState(project.product_description);
  const [prompt, setPrompt] = useState('');
  const centerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveIdx(versions.length - 1);
  }, [versions.length]);

  async function generate(args: {
    description: string;
    prompt: string;
    imageDataUrl: string | null;
  }) {
    setGenerating(true);
    setGenerationError(null);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          productDescription: args.description,
          prompt: args.prompt,
          imageDataUrl: args.imageDataUrl,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Generation failed (${res.status})`);
      }
      const json = (await res.json()) as { version: VersionWithOutputs; imageUrl?: string };
      setVersions((prev) => [...prev, json.version]);
      if (json.imageUrl) setImageUrl(json.imageUrl);
      router.refresh();
      setTimeout(() => {
        centerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  const activeVersion = versions[activeIdx];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border-b border-white/5 bg-bg/60 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-zinc-100 flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Dashboard
          </Link>
          <div className="w-px h-4 bg-white/10" />
          <h1 className="text-sm font-semibold truncate">{project.name}</h1>
          <span className="ml-auto text-xs text-zinc-500">
            {versions.length} version{versions.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <div className="flex-1 grid lg:grid-cols-[360px_1fr] min-h-0">
        <LeftPanel
          description={description}
          setDescription={setDescription}
          prompt={prompt}
          setPrompt={setPrompt}
          imageUrl={imageUrl}
          setImageUrl={setImageUrl}
          onGenerate={(payload) => generate(payload)}
          generating={generating}
          error={generationError}
          projectId={project.id}
        />

        <div ref={centerRef} className="overflow-y-auto bg-bg-elev/40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
            {versions.length > 0 && (
              <VersionTabs
                versions={versions}
                active={activeIdx}
                onSelect={setActiveIdx}
              />
            )}

            {generating && <GeneratingState />}

            {!generating && versions.length === 0 && <EmptyCenter />}

            {!generating && activeVersion && (
              <div className="mt-6 space-y-6">
                <DiagnosisPanel diagnosis={activeVersion.diagnosis} />
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {activeVersion.outputs
                    .slice()
                    .sort((a, b) => order(a.type) - order(b.type))
                    .map((out) => (
                      <InstagramCard key={out.id} output={out} username={project.name} />
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function order(type: string) {
  return type === 'studio' ? 0 : type === 'lifestyle' ? 1 : 2;
}

function GeneratingState() {
  return (
    <div className="mt-6">
      <div className="card p-6 mb-5">
        <div className="flex items-center gap-3 mb-3">
          <Sparkles className="w-4 h-4 text-brand-300 animate-pulse" />
          <span className="text-sm font-medium">Generating your campaign…</span>
        </div>
        <div className="space-y-2">
          <div className="h-3 rounded shimmer w-3/4" />
          <div className="h-3 rounded shimmer w-1/2" />
        </div>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card overflow-hidden">
            <div className="aspect-square shimmer" />
            <div className="p-4 space-y-2">
              <div className="h-3 rounded shimmer w-3/4" />
              <div className="h-3 rounded shimmer w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyCenter() {
  return (
    <div className="card p-16 text-center mt-6">
      <div className="w-12 h-12 rounded-xl bg-brand-500/15 text-brand-300 grid place-items-center mx-auto mb-4">
        <Sparkles className="w-6 h-6" />
      </div>
      <h3 className="font-semibold text-lg">No generations yet</h3>
      <p className="text-sm text-zinc-400 mt-1 max-w-sm mx-auto">
        Upload a product image (optional but recommended) and hit{' '}
        <span className="text-brand-300 font-medium">Generate</span> in the left panel.
      </p>
    </div>
  );
}

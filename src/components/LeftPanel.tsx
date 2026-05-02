'use client';

import { useRef, useState } from 'react';
import { Upload, Loader2, Sparkles, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export function LeftPanel(props: {
  description: string;
  setDescription: (s: string) => void;
  prompt: string;
  setPrompt: (s: string) => void;
  imageUrl: string | null;
  setImageUrl: (s: string | null) => void;
  onGenerate: (args: {
    description: string;
    prompt: string;
    imageDataUrl: string | null;
  }) => void;
  generating: boolean;
  error: string | null;
  projectId: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [pendingImageDataUrl, setPendingImageDataUrl] = useState<string | null>(null);

  async function readAsDataUrl(f: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(f);
    });
  }

  async function onFile(f: File) {
    if (!f.type.startsWith('image/')) {
      setUploadErr('File must be an image');
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setUploadErr('Image must be under 8MB');
      return;
    }
    setUploadErr(null);
    setUploading(true);
    try {
      const dataUrl = await readAsDataUrl(f);
      setPendingImageDataUrl(dataUrl);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: dataUrl,
          projectId: props.projectId,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? 'Upload failed');
      }
      const { url } = (await res.json()) as { url: string };
      props.setImageUrl(url);
    } catch (e) {
      setUploadErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function clearImage() {
    props.setImageUrl(null);
    setPendingImageDataUrl(null);
    if (fileInput.current) fileInput.current.value = '';
  }

  function submit() {
    props.onGenerate({
      description: props.description,
      prompt: props.prompt,
      imageDataUrl: pendingImageDataUrl,
    });
  }

  const canGenerate = !props.generating && props.description.trim().length > 0;
  const previewSrc = pendingImageDataUrl ?? props.imageUrl;

  return (
    <aside className="border-r border-white/5 bg-bg-elev/60 lg:max-h-[calc(100vh-7rem)] overflow-y-auto">
      <div className="p-5 space-y-5">
        <div>
          <label className="label">Product description</label>
          <textarea
            className="input min-h-[110px] resize-y"
            value={props.description}
            onChange={(e) => props.setDescription(e.target.value)}
            placeholder="Describe the product, audience, and angle…"
          />
        </div>

        <div>
          <label className="label">Direction (optional)</label>
          <textarea
            className="input min-h-[80px] resize-y"
            value={props.prompt}
            onChange={(e) => props.setPrompt(e.target.value)}
            placeholder="e.g. moody, cinematic, target Gen-Z runners"
          />
        </div>

        <div>
          <label className="label">Product image</label>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          {previewSrc ? (
            <div className="relative rounded-lg overflow-hidden border border-white/10 bg-bg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewSrc} alt="product" className="w-full aspect-square object-cover" />
              <button
                onClick={clearImage}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-black/70 hover:bg-black border border-white/10"
                aria-label="Remove image"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => fileInput.current?.click()}
                className="absolute bottom-2 right-2 text-xs btn-ghost py-1 px-2"
              >
                Replace
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInput.current?.click()}
              className="w-full aspect-square rounded-lg border-2 border-dashed border-white/10 hover:border-brand-500/50 hover:bg-white/5 transition grid place-items-center"
            >
              {uploading ? (
                <Loader2 className="w-5 h-5 animate-spin text-brand-300" />
              ) : (
                <div className="text-center">
                  <Upload className="w-5 h-5 mx-auto text-zinc-500 mb-2" />
                  <span className="text-sm text-zinc-400">Upload a product photo</span>
                  <span className="block text-xs text-zinc-600 mt-1">PNG / JPG, max 8MB</span>
                </div>
              )}
            </button>
          )}
          {uploadErr && (
            <div className="text-xs text-rose-400 mt-2">{uploadErr}</div>
          )}
        </div>

        {props.error && (
          <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
            {props.error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={!canGenerate}
          className="btn-primary w-full justify-center"
        >
          {props.generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Generating…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" /> Generate
            </>
          )}
        </button>

        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Each generation creates a new version. Old outputs are kept — switch between versions in
          the top tabs.
        </p>
      </div>
    </aside>
  );
}

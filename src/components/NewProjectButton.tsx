'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Plus, X } from 'lucide-react';

export function NewProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    if (!name.trim() || !description.trim()) {
      setErr('Both fields required');
      return;
    }
    setLoading(true);
    setErr(null);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) {
      setErr('Not signed in');
      setLoading(false);
      return;
    }
    const { data, error } = await sb
      .from('projects')
      .insert({
        user_id: user.id,
        name: name.trim(),
        product_description: description.trim(),
      })
      .select('id')
      .single();
    setLoading(false);
    if (error || !data) {
      setErr(error?.message ?? 'Failed to create project');
      return;
    }
    setOpen(false);
    router.push(`/project/${data.id}`);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus className="w-4 h-4" /> New project
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">New project</h2>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-white/5"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Project name</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vanilla Roast Coffee"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Product description</label>
                <textarea
                  className="input min-h-[100px] resize-y"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is the product? Who is it for? What's special about it?"
                />
              </div>
              {err && (
                <div className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                  {err}
                </div>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button className="btn-ghost" onClick={() => setOpen(false)} disabled={loading}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={create} disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />} Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

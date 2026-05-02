'use client';

import type { VersionWithOutputs } from '@/lib/types';
import { formatRelative } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function VersionTabs({
  versions,
  active,
  onSelect,
}: {
  versions: VersionWithOutputs[];
  active: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 -mb-2">
      {versions.map((v, i) => (
        <button
          key={v.id}
          onClick={() => onSelect(i)}
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-lg text-sm border transition',
            i === active
              ? 'bg-brand-500/20 border-brand-500/50 text-brand-200'
              : 'bg-white/[0.03] border-white/5 text-zinc-400 hover:text-zinc-100 hover:bg-white/5'
          )}
        >
          <span className="font-mono text-xs mr-1.5 opacity-70">v{i + 1}</span>
          {formatRelative(v.created_at)}
        </button>
      ))}
    </div>
  );
}

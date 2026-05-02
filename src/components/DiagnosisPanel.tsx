'use client';

import type { Diagnosis } from '@/lib/types';
import { AlertTriangle, EyeOff, Stethoscope } from 'lucide-react';

export function DiagnosisPanel({ diagnosis }: { diagnosis: Diagnosis }) {
  if (!diagnosis) return null;
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Stethoscope className="w-4 h-4 text-brand-300" />
        <h3 className="font-semibold">Diagnosis</h3>
      </div>
      {diagnosis.summary && (
        <p className="text-sm text-zinc-300 mb-4">{diagnosis.summary}</p>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        <DiagBlock
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
          color="rose"
          title="What's wrong"
          items={diagnosis.whats_wrong || []}
        />
        <DiagBlock
          icon={<EyeOff className="w-3.5 h-3.5" />}
          color="amber"
          title="What's missing"
          items={diagnosis.whats_missing || []}
        />
      </div>
    </div>
  );
}

function DiagBlock({
  icon,
  color,
  title,
  items,
}: {
  icon: React.ReactNode;
  color: 'rose' | 'amber';
  title: string;
  items: string[];
}) {
  const tone =
    color === 'rose'
      ? 'text-rose-300 bg-rose-500/10 border-rose-500/20'
      : 'text-amber-300 bg-amber-500/10 border-amber-500/20';
  return (
    <div className={`rounded-lg border ${tone} p-4`}>
      <div className="flex items-center gap-2 mb-2 font-medium text-sm">
        {icon} {title}
      </div>
      <ul className="space-y-1.5 text-sm text-zinc-300">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-zinc-500 select-none">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

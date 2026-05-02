import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Logo({ className, href = '/' }: { className?: string; href?: string | null }) {
  const inner = (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <span
        className="relative inline-block w-7 h-7 rounded-lg overflow-hidden"
        style={{
          background:
            'conic-gradient(from 215deg at 50% 50%, #8b3dff 0deg, #ff51d4 120deg, #38bdf8 240deg, #8b3dff 360deg)',
        }}
        aria-hidden
      >
        <span className="absolute inset-[3px] rounded-md bg-bg flex items-center justify-center text-[11px] font-bold text-white">
          P
        </span>
      </span>
      <span className="text-white">
        Pixig<span className="text-brand-400">.ai</span>
      </span>
    </span>
  );
  if (!href) return inner;
  return <Link href={href}>{inner}</Link>;
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/Header';
import { NewProjectButton } from '@/components/NewProjectButton';
import { Folder, ArrowRight, ImageOff } from 'lucide-react';
import { formatRelative, truncate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: projects } = await sb
    .from('projects')
    .select('id, name, product_description, image_url, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen">
      <Header variant="app" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Your projects</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Each project is one product. Inside, you can generate as many versions as you like.
            </p>
          </div>
          <NewProjectButton />
        </div>

        {!projects || projects.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/project/${p.id}`}
                className="card p-4 hover:border-brand-500/40 transition group"
              >
                <div className="aspect-video rounded-lg overflow-hidden bg-bg-elev mb-3 grid place-items-center">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <ImageOff className="w-6 h-6 text-zinc-600" />
                  )}
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{p.name}</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{formatRelative(p.created_at)}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-brand-300 transition shrink-0 mt-1" />
                </div>
                <p className="mt-3 text-sm text-zinc-400 line-clamp-2">
                  {truncate(p.product_description || 'No description', 120)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-16 text-center">
      <div className="w-12 h-12 rounded-xl bg-brand-500/15 text-brand-300 grid place-items-center mx-auto mb-4">
        <Folder className="w-6 h-6" />
      </div>
      <h3 className="font-semibold text-lg">No projects yet</h3>
      <p className="text-sm text-zinc-400 mt-1 mb-5">
        Create your first project — upload a product, generate a campaign.
      </p>
      <NewProjectButton />
    </div>
  );
}

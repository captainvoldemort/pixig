import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/Header';
import { ProjectWorkspace } from '@/components/ProjectWorkspace';
import type { Output, Project, VersionWithOutputs } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: project } = await sb
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!project) notFound();

  const { data: versionsRaw } = await sb
    .from('versions')
    .select('id, project_id, created_at, diagnosis, prompt')
    .eq('project_id', project.id)
    .order('created_at', { ascending: true });

  const versions: VersionWithOutputs[] = [];
  if (versionsRaw && versionsRaw.length) {
    const { data: outputsRaw } = await sb
      .from('outputs')
      .select('*')
      .in(
        'version_id',
        versionsRaw.map((v) => v.id)
      );
    const outputsByVersion = new Map<string, Output[]>();
    (outputsRaw ?? []).forEach((o: Output) => {
      const arr = outputsByVersion.get(o.version_id) ?? [];
      arr.push(o);
      outputsByVersion.set(o.version_id, arr);
    });
    for (const v of versionsRaw) {
      versions.push({
        ...(v as any),
        outputs: outputsByVersion.get(v.id) ?? [],
      });
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header variant="app" />
      <ProjectWorkspace project={project as Project} initialVersions={versions} />
    </div>
  );
}

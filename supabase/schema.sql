-- =========================================================================
-- Pixig.ai — Supabase schema
-- Run this entire file in the Supabase SQL editor.
-- =========================================================================

-- Required for gen_random_uuid()
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------
-- projects
-- -----------------------------------------------------------------------
create table if not exists public.projects (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  product_description text not null default '',
  image_url           text,
  created_at          timestamptz not null default now()
);

create index if not exists projects_user_id_created_idx
  on public.projects(user_id, created_at desc);

-- -----------------------------------------------------------------------
-- versions
-- -----------------------------------------------------------------------
create table if not exists public.versions (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  created_at  timestamptz not null default now(),
  diagnosis   jsonb not null default '{}'::jsonb,
  prompt      text
);

create index if not exists versions_project_id_created_idx
  on public.versions(project_id, created_at);

-- -----------------------------------------------------------------------
-- outputs
-- -----------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'output_type') then
    create type public.output_type as enum ('studio', 'lifestyle', 'poster');
  end if;
end$$;

create table if not exists public.outputs (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references public.versions(id) on delete cascade,
  type          public.output_type not null,
  image_url     text not null default '',  -- '' when running text-only (no image gen)
  image_prompt  text not null default '',  -- rich prompt user can paste into any image-gen tool
  hook          text not null default '',
  caption       text not null default '',
  reasoning     text not null default ''
);

create index if not exists outputs_version_id_idx on public.outputs(version_id);

-- =========================================================================
-- Row-level security
-- =========================================================================
alter table public.projects enable row level security;
alter table public.versions enable row level security;
alter table public.outputs  enable row level security;

-- projects: a user can do anything with their own projects
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
  for select using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own" on public.projects
  for delete using (auth.uid() = user_id);

-- versions: scoped through the parent project
drop policy if exists "versions_select_own" on public.versions;
create policy "versions_select_own" on public.versions
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = versions.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "versions_insert_own" on public.versions;
create policy "versions_insert_own" on public.versions
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = versions.project_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "versions_delete_own" on public.versions;
create policy "versions_delete_own" on public.versions
  for delete using (
    exists (
      select 1 from public.projects p
      where p.id = versions.project_id and p.user_id = auth.uid()
    )
  );

-- outputs: scoped through versions → projects
drop policy if exists "outputs_select_own" on public.outputs;
create policy "outputs_select_own" on public.outputs
  for select using (
    exists (
      select 1 from public.versions v
      join public.projects p on p.id = v.project_id
      where v.id = outputs.version_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "outputs_insert_own" on public.outputs;
create policy "outputs_insert_own" on public.outputs
  for insert with check (
    exists (
      select 1 from public.versions v
      join public.projects p on p.id = v.project_id
      where v.id = outputs.version_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "outputs_delete_own" on public.outputs;
create policy "outputs_delete_own" on public.outputs
  for delete using (
    exists (
      select 1 from public.versions v
      join public.projects p on p.id = v.project_id
      where v.id = outputs.version_id and p.user_id = auth.uid()
    )
  );

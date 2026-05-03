-- Migration: text-only pipeline support.
-- Run this in Supabase SQL Editor once on installs that pre-date the
-- text-only pipeline. Idempotent and safe — only ADDS a column; doesn't
-- touch existing data, columns, or constraints.

alter table public.outputs
  add column if not exists image_prompt text not null default '';

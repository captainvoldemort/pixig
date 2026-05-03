import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadBase64 } from '@/lib/cloudinary';
import { generatePlan } from '@/lib/gemini';
import type { Output, OutputType, VersionWithOutputs } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

// Pixig is currently text-only on free tier — every Gemini/Imagen image-gen
// model is paid-only per https://ai.google.dev/gemini-api/docs/pricing.
// To re-enable image generation: enable billing on the GCP project, then set
// TEXT_ONLY = false (and import generateImage from '@/lib/gemini').
const TEXT_ONLY = true;

interface Body {
  projectId: string;
  productDescription: string;
  prompt?: string;
  imageDataUrl?: string | null;
}

function parseDataUrl(dataUrl: string | null | undefined) {
  if (!dataUrl) return null;
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

async function fetchAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
    const buf = Buffer.from(await res.arrayBuffer());
    return { base64: buf.toString('base64'), mimeType };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as Body;
    if (!body.projectId || !body.productDescription?.trim()) {
      return NextResponse.json(
        { error: 'projectId and productDescription required' },
        { status: 400 }
      );
    }

    const { data: project, error: projErr } = await sb
      .from('projects')
      .select('id, user_id, image_url, product_description')
      .eq('id', body.projectId)
      .eq('user_id', user.id)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 1. Resolve / persist the source product image.
    let sourceImage: { base64: string; mimeType: string } | null = parseDataUrl(body.imageDataUrl);
    let projectImageUrl = project.image_url;

    if (sourceImage && !projectImageUrl) {
      const uploaded = await uploadBase64({
        base64: sourceImage.base64,
        mimeType: sourceImage.mimeType,
        folder: `pixig/users/${user.id}/uploads`,
      });
      projectImageUrl = uploaded.url;
    } else if (!sourceImage && projectImageUrl) {
      sourceImage = await fetchAsBase64(projectImageUrl);
    }

    // Persist any updated description / image on the project.
    if (
      body.productDescription.trim() !== project.product_description ||
      projectImageUrl !== project.image_url
    ) {
      await sb
        .from('projects')
        .update({
          product_description: body.productDescription.trim(),
          image_url: projectImageUrl,
        })
        .eq('id', project.id);
    }

    // 2. Plan: ask Gemini for diagnosis + structured creative briefs.
    const plan = await generatePlan({
      productDescription: body.productDescription.trim(),
      userPrompt: body.prompt,
      imageBase64: sourceImage?.base64,
      imageMimeType: sourceImage?.mimeType,
    });

    // 3. Build output rows.
    //    TEXT_ONLY: skip image generation; persist image_url='' so the UI
    //    renders a "copy this prompt" card instead of a generated image.
    void TEXT_ONLY;
    const successfulOutputs = plan.outputs.map((o) => ({
      type: o.type as OutputType,
      image_url: '',
      image_prompt: o.image_prompt,
      hook: o.hook,
      caption: o.caption,
      reasoning: o.reasoning,
    }));

    // 4. Persist version + outputs.
    const { data: version, error: vErr } = await sb
      .from('versions')
      .insert({
        project_id: project.id,
        diagnosis: plan.diagnosis,
        prompt: body.prompt ?? null,
      })
      .select('id, project_id, created_at, diagnosis, prompt')
      .single();

    if (vErr || !version) {
      return NextResponse.json(
        { error: vErr?.message ?? 'Failed to save version' },
        { status: 500 }
      );
    }

    const insertRows = successfulOutputs.map((o) => ({
      version_id: version.id,
      type: o.type,
      image_url: o.image_url,
      image_prompt: o.image_prompt,
      hook: o.hook,
      caption: o.caption,
      reasoning: o.reasoning,
    }));

    const { data: outputs, error: oErr } = await sb
      .from('outputs')
      .insert(insertRows)
      .select('*');

    if (oErr || !outputs) {
      return NextResponse.json(
        { error: oErr?.message ?? 'Failed to save outputs' },
        { status: 500 }
      );
    }

    const versionWithOutputs: VersionWithOutputs = {
      ...(version as any),
      outputs: outputs as Output[],
    };

    return NextResponse.json({
      version: versionWithOutputs,
      imageUrl: projectImageUrl,
    });
  } catch (err) {
    console.error('generate error', err);
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

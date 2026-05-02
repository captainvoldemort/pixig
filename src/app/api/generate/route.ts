import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadBase64 } from '@/lib/cloudinary';
import { generateImage, generatePlan } from '@/lib/gemini';
import type { Output, OutputType, VersionWithOutputs } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 300;

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

    // 3. Generate one image per output type, in parallel, and upload to Cloudinary.
    const outputsRaw = await Promise.all(
      plan.outputs.map(async (o) => {
        try {
          const img = await generateImage({
            prompt: o.image_prompt,
            type: o.type,
            productImageBase64: sourceImage?.base64,
            productImageMimeType: sourceImage?.mimeType,
            hook: o.hook,
          });
          const uploaded = await uploadBase64({
            base64: img.base64,
            mimeType: img.mimeType,
            folder: `pixig/users/${user.id}/projects/${project.id}/outputs`,
          });
          return {
            ok: true as const,
            value: {
              type: o.type as OutputType,
              image_url: uploaded.url,
              hook: o.hook,
              caption: o.caption,
              reasoning: o.reasoning,
            },
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`[generate] ${o.type} failed:`, message);
          return { ok: false as const, type: o.type, message };
        }
      })
    );

    const successfulOutputs = outputsRaw
      .filter((r): r is { ok: true; value: any } => r.ok)
      .map((r) => r.value);

    if (successfulOutputs.length === 0) {
      const reasons = outputsRaw
        .filter((r): r is { ok: false; type: string; message: string } => !r.ok)
        .map((r) => `${r.type}: ${r.message}`)
        .join(' | ');
      return NextResponse.json(
        {
          error: `All image generations failed. ${reasons || 'No reasons captured.'}`,
        },
        { status: 502 }
      );
    }

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

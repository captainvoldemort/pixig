import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadBase64 } from '@/lib/cloudinary';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Body {
  imageDataUrl: string;
  projectId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await req.json()) as Body;
    if (!body?.imageDataUrl?.startsWith('data:')) {
      return NextResponse.json({ error: 'imageDataUrl required' }, { status: 400 });
    }

    const match = body.imageDataUrl.match(/^data:(.+?);base64,(.+)$/);
    if (!match) return NextResponse.json({ error: 'Invalid data URL' }, { status: 400 });
    const [, mimeType, base64] = match;

    const { url } = await uploadBase64({
      base64,
      mimeType,
      folder: `pixig/users/${user.id}/uploads`,
    });

    if (body.projectId) {
      const { error: updateErr } = await sb
        .from('projects')
        .update({ image_url: url })
        .eq('id', body.projectId)
        .eq('user_id', user.id);
      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

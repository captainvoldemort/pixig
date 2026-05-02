import { v2 as cloudinary } from 'cloudinary';

let configured = false;

function configure() {
  if (configured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

export async function uploadBase64(args: {
  base64: string;
  mimeType: string;
  folder?: string;
  publicId?: string;
}): Promise<{ url: string; publicId: string }> {
  configure();
  const folder = args.folder ?? process.env.CLOUDINARY_UPLOAD_FOLDER ?? 'pixig';
  const dataUri = `data:${args.mimeType};base64,${args.base64}`;

  const res = await cloudinary.uploader.upload(dataUri, {
    folder,
    public_id: args.publicId,
    resource_type: 'image',
    overwrite: false,
    unique_filename: true,
  });

  return { url: res.secure_url, publicId: res.public_id };
}

export async function uploadBuffer(args: {
  buffer: Buffer;
  mimeType: string;
  folder?: string;
}): Promise<{ url: string; publicId: string }> {
  return uploadBase64({
    base64: args.buffer.toString('base64'),
    mimeType: args.mimeType,
    folder: args.folder,
  });
}

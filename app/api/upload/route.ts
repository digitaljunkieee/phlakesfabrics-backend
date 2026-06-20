import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { requireAuthWithRole } from '../../../lib/requireAuth';

type CloudinaryUploadResult = {
  secure_url?: string;
  url?: string;
  public_id?: string;
};

const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim();

if (cloudinaryUrl) {
  cloudinary.config(cloudinaryUrl);
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function serializeCloudinaryError(error: unknown) {
  const err = error as Record<string, any>;
  const nestedErrors = Array.isArray(err?.errors)
    ? err.errors.slice(0, 3).map((item: unknown) => {
        if (!item || typeof item !== 'object') return String(item ?? '');
        const nested = item as Record<string, any>;
        return nested.message || nested.error || nested.code || JSON.stringify(nested);
      })
    : [];

  return {
    name: err?.name || 'CloudinaryError',
    message: err?.message || 'Cloudinary upload failed',
    code: err?.code || null,
    http_code: err?.http_code || null,
    nestedErrors,
    hint:
      err?.http_code === 401 && typeof err?.message === 'string' && err.message.includes('Invalid Signature')
        ? 'Cloudinary rejected the signature. Verify CLOUDINARY_API_SECRET in backend/.env, or set CLOUDINARY_UPLOAD_PRESET and use an unsigned upload preset.'
        : err?.http_code === 403
          ? 'Cloudinary blocked the upload because the current API credentials are not allowed to create assets. Use an API key/secret with upload/create permission for this cloud, or configure CLOUDINARY_UPLOAD_PRESET with an unsigned upload preset.'
        : err?.http_code === 400 && typeof err?.message === 'string' && err.message.includes('not allowed when using unsigned upload')
          ? 'Cloudinary rejected an upload option for this unsigned preset. The server now sends only folder and public_id for unsigned uploads; restart the backend and try again.'
        : null,
  };
}

function sanitizePublicIdSegment(value: string, fallback = 'image') {
  const baseName = path.parse(String(value || fallback)).name || fallback;
  const sanitized = baseName
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

  return `${sanitized || fallback}-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

function getCloudinaryConfigHint(uploadPreset: string) {
  if (!uploadPreset) {
    const cloudinaryUrl = process.env.CLOUDINARY_URL?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim() || '';
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim() || '';

    if (!cloudinaryUrl && apiKey && apiSecret && apiKey === apiSecret) {
      return 'CLOUDINARY_API_SECRET is the same as CLOUDINARY_API_KEY in backend/.env. Replace it with the real Cloudinary API Secret, or set CLOUDINARY_UPLOAD_PRESET for unsigned uploads.';
    }
  }

  return null;
}

function uploadToCloudinary(buffer: Buffer, { uploadPreset = '', fileName = 'product-image' } = {}) {
  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const callback = (error: unknown, result: CloudinaryUploadResult | undefined) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(result || {});
    };

    const unsignedUploadOptions = {
      folder: 'phlakesfabrics',
      public_id: sanitizePublicIdSegment(fileName, 'product-image'),
    };

    const signedUploadOptions = {
      ...unsignedUploadOptions,
      resource_type: 'image' as const,
      overwrite: false,
    };

    const stream = uploadPreset
      ? cloudinary.uploader.unsigned_upload_stream(uploadPreset, unsignedUploadOptions, callback)
      : cloudinary.uploader.upload_stream(signedUploadOptions, callback);

    stream.on('error', reject);
    stream.end(buffer);
  });
}

export async function POST(req: Request) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager', 'sales_staff']);
  if (!auth.authorized) return auth.response;

  try {
    let formData: FormData;

    try {
      formData = await req.formData();
    } catch (error) {
      console.error('Upload form parse error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Upload request could not be read. Please choose the image again and retry.',
          details: {
            message: error instanceof Error ? error.message : 'Failed to parse multipart form data',
          },
        },
        { status: 400 }
      );
    }

    const file =
      (formData.get('image') as File | null) ||
      (formData.get('file') as File | null) ||
      (formData.get('photo') as File | null);

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    if (file.type && !file.type.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'Only image files can be uploaded' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.length === 0) {
      return NextResponse.json({ success: false, error: 'Selected image is empty' }, { status: 400 });
    }

    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET?.trim() || '';
    const configHint = getCloudinaryConfigHint(uploadPreset);

    if (configHint) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cloudinary is misconfigured',
          hint: configHint,
        },
        { status: 500 }
      );
    }

    let uploadResult: CloudinaryUploadResult;

    try {
      uploadResult = await uploadToCloudinary(buffer, {
        uploadPreset,
        fileName: file.name,
      });
    } catch (error) {
      const details = serializeCloudinaryError(error);
      console.error('Cloudinary Upload Error:', details);
      return NextResponse.json(
        {
          success: false,
          error: details.message,
          details,
          hint: details.hint,
        },
        { status: 500 }
      );
    }

    const resolvedUrl = uploadResult.secure_url || uploadResult.url;

    if (!resolvedUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cloudinary upload did not return a URL',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: resolvedUrl,
      secureUrl: uploadResult.secure_url || resolvedUrl,
      publicId: uploadResult.public_id || null,
    }, { status: 200 });

  } catch (error) {
    const details = serializeCloudinaryError(error);
    console.error("Cloudinary Upload Error:", details);
    return NextResponse.json({ success: false, error: details.message, details }, { status: 500 });
  }
}

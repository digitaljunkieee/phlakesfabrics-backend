import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { requireAuthWithRole } from '../../../lib/requireAuth';

type CloudinaryUploadResult = {
  secure_url?: string;
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: Request) {
  const auth = await requireAuthWithRole(req, ['admin', 'super_admin', 'branch_manager', 'sales_staff']);
  if (!auth.authorized) return auth.response;

  try {
    const formData = await req.formData();
    const file =
      (formData.get('image') as File | null) ||
      (formData.get('file') as File | null) ||
      (formData.get('photo') as File | null);

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadResult = await new Promise<CloudinaryUploadResult | undefined>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'phlakesfabrics' }, 
        (error, result) => {
          if (error) reject(error);
          else resolve(result ?? undefined);
        }
      );
      uploadStream.end(buffer);
    });

    if (!uploadResult?.secure_url) {
      return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      url: uploadResult.secure_url
    }, { status: 200 });

  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 });
  }
}

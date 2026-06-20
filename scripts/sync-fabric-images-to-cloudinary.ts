import { promises as fs } from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function slugify(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

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

async function uploadImage(filePath: string, fileName: string) {
  const publicId = slugify(path.parse(fileName).name);
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET?.trim() || '';

  const result = uploadPreset
    ? await cloudinary.uploader.unsigned_upload(filePath, uploadPreset, {
        folder: 'phlakesfabrics/fabric-assets',
        public_id: publicId,
      })
    : await cloudinary.uploader.upload(filePath, {
        folder: 'phlakesfabrics/fabric-assets',
        public_id: publicId,
        overwrite: true,
        invalidate: true,
        resource_type: 'image',
      });

  return result.secure_url || result.url || '';
}

async function ensureUploadPath(filePath: string, fileName: string) {
  const stats = await fs.stat(filePath);
  const shouldCompress = stats.size > 10 * 1024 * 1024 && /\.(jpe?g)$/i.test(fileName);

  if (!shouldCompress) return filePath;

  const tempDir = path.join(os.tmpdir(), 'phlakesfabrics-cloudinary');
  await fs.mkdir(tempDir, { recursive: true });

  const compressedPath = path.join(tempDir, `${slugify(path.parse(fileName).name)}-compressed.jpg`);
  try {
    await fs.access(compressedPath);
    return compressedPath;
  } catch {
    // fall through to compression
  }

  const psScript = `
    Add-Type -AssemblyName System.Drawing
    $source = ${JSON.stringify(filePath)}
    $dest = ${JSON.stringify(compressedPath)}
    $maxWidth = 1800
    $quality = 82L

    $img = [System.Drawing.Image]::FromFile($source)
    try {
      $ratio = [Math]::Min($maxWidth / [double]$img.Width, $maxWidth / [double]$img.Height)
      if ($ratio -gt 1) { $ratio = 1 }
      $newWidth = [int][Math]::Round($img.Width * $ratio)
      $newHeight = [int][Math]::Round($img.Height * $ratio)

      $bitmap = New-Object System.Drawing.Bitmap $newWidth, $newHeight
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.DrawImage($img, 0, 0, $newWidth, $newHeight)

        $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' } | Select-Object -First 1
        $params = New-Object System.Drawing.Imaging.EncoderParameters 1
        $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $quality)
        $bitmap.Save($dest, $codec, $params)
        $params.Dispose()
      } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
      }
    } finally {
      $img.Dispose()
    }
  `;

  const result = spawnSync('powershell', ['-NoProfile', '-Command', psScript], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(
      `Failed to compress ${fileName}: ${result.stderr || result.stdout || 'PowerShell compression failed'}`
    );
  }

  return compressedPath;
}

async function main() {
  const frontendImagesDir = path.resolve(process.cwd(), '..', 'frontend', 'public', 'images');
  const frontendManifestPath = path.resolve(process.cwd(), '..', 'frontend', 'src', 'lib', 'cloudinaryFabricAssets.json');
  const backendManifestPath = path.resolve(process.cwd(), 'lib', 'cloudinaryFabricAssets.json');

  const entries = await fs.readdir(frontendImagesDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((file) => /\.(png|jpe?g|webp|gif|avif)$/i.test(file))
    .sort((a, b) => a.localeCompare(b));

  if (!files.length) {
    throw new Error(`No image files found in ${frontendImagesDir}`);
  }

  const manifest: Record<string, string> = {};

  for (const fileName of files) {
    const filePath = path.join(frontendImagesDir, fileName);
    const uploadPath = await ensureUploadPath(filePath, fileName);
    const url = await uploadImage(uploadPath, fileName);

    if (!url) {
      throw new Error(`Cloudinary upload returned no URL for ${fileName}`);
    }

    manifest[fileName] = url;
    console.log(`Uploaded ${fileName}`);
    console.log(`  ${url}`);
  }

  const payload = `${JSON.stringify(manifest, null, 2)}\n`;
  await fs.writeFile(frontendManifestPath, payload, 'utf8');
  await fs.writeFile(backendManifestPath, payload, 'utf8');

  console.log(`Wrote ${files.length} image URLs to:`);
  console.log(`  ${frontendManifestPath}`);
  console.log(`  ${backendManifestPath}`);
}

main().catch((error) => {
  console.error('Fabric image sync failed:', error);
  process.exit(1);
});

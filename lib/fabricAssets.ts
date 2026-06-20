import imageManifest from './cloudinaryFabricAssets.json';

const fabricImages = imageManifest as Record<string, string>;

export function fabricImage(fileName: string) {
  return fabricImages[fileName] || '';
}

export const fabricImageManifest = fabricImages;

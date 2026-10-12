'use client';

import { browserClient } from '@/lib/supabase/browser';

/**
 * Shrink a photo on the phone before upload (fast on truck signal, and strips the
 * location data that phones put in photos), then store it under the business folder.
 */
export async function uploadImage(businessId: string, file: File, opts: { max?: number; keepPng?: boolean } = {}): Promise<string> {
  const max = opts.max ?? 1600;
  let blob: Blob = file;
  let ext = 'jpg';
  if (file.type === 'image/svg+xml') {
    ext = 'svg';
  } else {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const png = opts.keepPng && file.type === 'image/png';
    ext = png ? 'png' : 'jpg';
    blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not read that photo'))), png ? 'image/png' : 'image/jpeg', 0.82));
  }
  const path = `${businessId}/${crypto.randomUUID()}.${ext}`;
  const sb = browserClient();
  const { error } = await sb.storage.from('media').upload(path, blob, { contentType: blob.type || file.type, cacheControl: '31536000' });
  if (error) throw new Error('Upload failed. Try again.');
  return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
}

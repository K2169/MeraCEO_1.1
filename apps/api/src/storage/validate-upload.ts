// Object metadata is checked after PUT; a signed upload URL alone cannot enforce size.
export function validUploadedImage(key: string, kind: 'photo' | 'logo', metadata: { contentType: string; contentLength: number } | null): boolean {
  if (!metadata || !Number.isFinite(metadata.contentLength) || metadata.contentLength <= 0) return false;
  const extension = key.split('.').pop()?.toLowerCase();
  const expected: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  if (!extension || expected[extension] !== metadata.contentType) return false;
  return kind !== 'logo' || (extension !== 'webp' && metadata.contentLength <= 2 * 1024 * 1024);
}

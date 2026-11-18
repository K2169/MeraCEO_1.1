import { describe, expect, it } from 'vitest';
import { validUploadedImage } from '../src/storage/validate-upload.js';

describe('uploaded logo validation', () => {
  it('accepts PNG/JPEG up to 2 MiB and rejects larger, empty, absent and mismatched metadata', () => {
    expect(validUploadedImage('owner/logos/logo.png', 'logo', { contentType: 'image/png', contentLength: 2 * 1024 * 1024 })).toBe(true);
    expect(validUploadedImage('owner/logos/logo.jpg', 'logo', { contentType: 'image/jpeg', contentLength: 1 })).toBe(true);
    for (const contentLength of [0, -1, 2 * 1024 * 1024 + 1, Infinity]) expect(validUploadedImage('logo.png', 'logo', { contentType: 'image/png', contentLength })).toBe(false);
    expect(validUploadedImage('logo.png', 'logo', null)).toBe(false);
    expect(validUploadedImage('logo.png', 'logo', { contentType: 'image/jpeg', contentLength: 100 })).toBe(false);
  });
  it('refuses WebP logos while preserving professional photo WebP support', () => {
    const metadata = { contentType: 'image/webp', contentLength: 100 };
    expect(validUploadedImage('logo.webp', 'logo', metadata)).toBe(false);
    expect(validUploadedImage('photo.webp', 'photo', metadata)).toBe(true);
  });
});

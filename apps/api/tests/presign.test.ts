import { describe, expect, it } from 'vitest';

import { buildUploadKey, createS3Client, createUploadUrl, PRESIGN_TTL_SECONDS } from '../src/storage/presign.js';

const UUID = '6f1c2b8e-1111-4aaa-9bbb-222233334444';

const client = createS3Client({
  endpoint: 'https://s3.us-east-005.backblazeb2.com',
  region: 'us-east-005',
  accessKeyId: 'test-key-id',
  secretAccessKey: 'test-secret',
});

describe('buildUploadKey', () => {
  it('puts every upload under the owner folder', () => {
    expect(buildUploadKey({ userId: 'user-1', kind: 'logo', contentType: 'image/png' }, UUID)).toBe(
      `user-1/logos/${UUID}.png`,
    );
    expect(buildUploadKey({ userId: 'user-1', kind: 'credential', contentType: 'application/pdf' }, UUID)).toBe(
      `user-1/credentials/${UUID}.pdf`,
    );
  });

  it('refuses content types outside the allowlist', () => {
    expect(buildUploadKey({ userId: 'user-1', kind: 'logo', contentType: 'text/html' }, UUID)).toBeNull();
    expect(buildUploadKey({ userId: 'user-1', kind: 'logo', contentType: 'application/pdf' }, UUID)).toBeNull();
  });
});

describe('createUploadUrl', () => {
  it('returns a path-style presigned PUT that expires in 5 minutes', async () => {
    const result = await createUploadUrl(
      client,
      'meraceo-dev',
      { userId: 'user-1', kind: 'logo', contentType: 'image/jpeg' },
      UUID,
    );
    expect(result).not.toBeNull();
    const url = new URL(result!.uploadUrl);
    expect(url.hostname).toBe('s3.us-east-005.backblazeb2.com');
    expect(url.pathname).toBe(`/meraceo-dev/user-1/logos/${UUID}.jpg`);
    expect(url.searchParams.get('X-Amz-Expires')).toBe(String(PRESIGN_TTL_SECONDS));
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(result!.expiresIn).toBe(300);
  });

  it('returns null for a disallowed type and never signs it', async () => {
    const result = await createUploadUrl(client, 'meraceo-dev', {
      userId: 'user-1',
      kind: 'logo',
      contentType: 'text/html',
    });
    expect(result).toBeNull();
  });
});

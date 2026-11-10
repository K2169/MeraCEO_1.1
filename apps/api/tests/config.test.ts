import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config.js';

const valid = {
  PORT: '3000',
  MONGODB_URI: 'mongodb+srv://user:pass@cluster.example.net',
  MONGODB_DB: 'meraceo_dev',
  SESSION_JWT_SECRET: 'x'.repeat(40),
  GOOGLE_WEB_CLIENT_ID: '123-web.apps.googleusercontent.com',
  GOOGLE_ANDROID_CLIENT_ID: '123-debug.apps.googleusercontent.com',
  GOOGLE_ANDROID_RELEASE_CLIENT_ID: '123-release.apps.googleusercontent.com',
  S3_ENDPOINT: 'https://s3.us-east-005.backblazeb2.com',
  S3_REGION: 'us-east-005',
  S3_BUCKET: 'meraceo-dev',
  S3_ACCESS_KEY_ID: 'key-id',
  S3_SECRET_ACCESS_KEY: 'key-secret',
};

describe('loadConfig', () => {
  it('accepts a complete environment and lists all Google audiences', () => {
    const config = loadConfig(valid);
    expect(config.googleAudiences).toEqual([
      '123-web.apps.googleusercontent.com',
      '123-debug.apps.googleusercontent.com',
      '123-release.apps.googleusercontent.com',
    ]);
    expect(config.s3.bucket).toBe('meraceo-dev');
  });

  it('names the missing keys without echoing any value', () => {
    const rest: Record<string, string> = { ...valid };
    delete rest.SESSION_JWT_SECRET;
    expect(() => loadConfig(rest)).toThrow(/SESSION_JWT_SECRET/);
    expect(() => loadConfig({ ...valid, SESSION_JWT_SECRET: 'short' })).toThrow(/SESSION_JWT_SECRET/);
    try {
      loadConfig({ ...valid, MONGODB_URI: 'http://not-mongo' });
    } catch (err) {
      expect((err as Error).message).toContain('MONGODB_URI');
      expect((err as Error).message).not.toContain('not-mongo');
    }
  });

  it('rejects a Google client ID that is not an OAuth client ID', () => {
    expect(() => loadConfig({ ...valid, GOOGLE_WEB_CLIENT_ID: 'AIza-api-key' })).toThrow(/GOOGLE_WEB_CLIENT_ID/);
  });
});

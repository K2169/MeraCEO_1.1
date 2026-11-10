import type { OAuth2Client, TokenPayload } from 'google-auth-library';
import { describe, expect, it } from 'vitest';

import { AuthError, createGoogleVerifier } from '../src/auth/google.js';
import { issueSessionToken, verifySessionToken } from '../src/auth/session.js';

const SECRET = 'x'.repeat(40);
const WEB = '123-abc.apps.googleusercontent.com';

function fakeClient(payload: Partial<TokenPayload> | 'throw'): OAuth2Client {
  return {
    verifyIdToken: async () => {
      if (payload === 'throw') throw new Error('bad signature');
      return { getPayload: () => payload as TokenPayload };
    },
  } as unknown as OAuth2Client;
}

const goodPayload: Partial<TokenPayload> = {
  sub: 'google-sub-1',
  email: 'person@example.com',
  email_verified: true,
  iss: 'https://accounts.google.com',
  name: 'Test Person',
};

describe('createGoogleVerifier', () => {
  it('returns the identity for a verified Google token', async () => {
    const verify = createGoogleVerifier([WEB], fakeClient(goodPayload));
    await expect(verify('token')).resolves.toEqual({
      sub: 'google-sub-1',
      email: 'person@example.com',
      name: 'Test Person',
    });
  });

  it('rejects a token whose signature or audience check fails', async () => {
    const verify = createGoogleVerifier([WEB], fakeClient('throw'));
    await expect(verify('token')).rejects.toMatchObject({ reason: 'invalid_token' });
  });

  it('rejects an unverified email', async () => {
    const verify = createGoogleVerifier([WEB], fakeClient({ ...goodPayload, email_verified: false }));
    await expect(verify('token')).rejects.toBeInstanceOf(AuthError);
    await expect(verify('token')).rejects.toMatchObject({ reason: 'email_not_verified' });
  });

  it('rejects a token from an unexpected issuer', async () => {
    const verify = createGoogleVerifier([WEB], fakeClient({ ...goodPayload, iss: 'https://evil.example' }));
    await expect(verify('token')).rejects.toMatchObject({ reason: 'invalid_token' });
  });
});

describe('session tokens', () => {
  it('round-trips the user id', async () => {
    const token = await issueSessionToken('user-42', SECRET);
    await expect(verifySessionToken(token, SECRET)).resolves.toBe('user-42');
  });

  it('rejects a token signed with another secret', async () => {
    const token = await issueSessionToken('user-42', SECRET);
    await expect(verifySessionToken(token, 'y'.repeat(40))).resolves.toBeNull();
  });

  it('rejects a tampered token', async () => {
    const token = await issueSessionToken('user-42', SECRET);
    const [header, , signature] = token.split('.');
    const forged = `${header}.${Buffer.from(JSON.stringify({ sub: 'admin' })).toString('base64url')}.${signature}`;
    await expect(verifySessionToken(forged, SECRET)).resolves.toBeNull();
  });

  it('rejects an expired token', async () => {
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const token = await issueSessionToken('user-42', SECRET, twoWeeksAgo);
    await expect(verifySessionToken(token, SECRET)).resolves.toBeNull();
  });

  it('returns null for garbage input', async () => {
    await expect(verifySessionToken('not-a-jwt', SECRET)).resolves.toBeNull();
  });
});

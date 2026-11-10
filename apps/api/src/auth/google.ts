import { OAuth2Client } from 'google-auth-library';

export interface GoogleIdentity {
  sub: string;
  email: string;
  name?: string;
}

export type GoogleVerifier = (idToken: string) => Promise<GoogleIdentity>;

// Error thrown when a Google sign-in token is not acceptable.
export class AuthError extends Error {
  constructor(public readonly reason: 'invalid_token' | 'email_not_verified') {
    super(reason);
  }
}

const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

// Checks signature, expiry, issuer and audience (our client IDs), then requires a verified email.
export function createGoogleVerifier(audiences: readonly string[], client = new OAuth2Client()): GoogleVerifier {
  return async (idToken) => {
    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: [...audiences] });
      payload = ticket.getPayload();
    } catch {
      throw new AuthError('invalid_token');
    }
    if (!payload?.sub || !payload.email || !GOOGLE_ISSUERS.includes(payload.iss ?? '')) {
      throw new AuthError('invalid_token');
    }
    if (payload.email_verified !== true) {
      throw new AuthError('email_not_verified');
    }
    return { sub: payload.sub, email: payload.email, name: payload.name };
  };
}

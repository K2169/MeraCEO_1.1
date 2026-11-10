import { jwtVerify, SignJWT } from 'jose';

// Session tokens are issued by this API after Google has verified the user (plan W2-03/W2-04).
const ALGORITHM = 'HS256';
const TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Turns the secret text into the key format the token library needs.
function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

// Creates a signed session token for a user. It lasts 7 days.
export async function issueSessionToken(userId: string, secret: string, now = Date.now()): Promise<string> {
  const issuedAt = Math.floor(now / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + TTL_SECONDS)
    .sign(key(secret));
}

// Returns the user id, or null when the token is missing, forged, expired or malformed.
export async function verifySessionToken(token: string, secret: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: [ALGORITHM] });
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const COST = 32768;
const KEY_BYTES = 64;
const DUMMY_SALT = '00000000000000000000000000000000';

// Bounded input avoids excessive work before the deliberately expensive password hash.
export function validPassword(password: string): boolean {
  return password.length >= 12 && Buffer.byteLength(password, 'utf8') <= 128;
}

// Use asynchronous scrypt so hashing does not block the request event loop.
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_BYTES, { N: COST, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
  });
}

// Each password has a fresh cryptographic salt and an explicit algorithm version.
export async function hashPassword(password: string): Promise<string> {
  if (!validPassword(password)) throw new Error('invalid_password');
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt);
  return `scrypt-v1$${salt}$${key.toString('hex')}`;
}

// Unknown users and malformed hashes still pay the same derivation cost.
export async function verifyPassword(password: string, stored?: string): Promise<boolean> {
  const inputValid = validPassword(password);
  const parts = stored?.split('$');
  const valid = validPassword(password) && parts?.length === 3 && parts[0] === 'scrypt-v1' && /^[0-9a-f]{32}$/.test(parts[1]) && /^[0-9a-f]{128}$/.test(parts[2]);
  const usableHash = valid && inputValid;
  const key = await derive(password.slice(0, 128), usableHash ? parts[1] : DUMMY_SALT);
  const expected = usableHash ? Buffer.from(parts[2], 'hex') : Buffer.alloc(KEY_BYTES);
  return timingSafeEqual(key, expected) && Boolean(usableHash);
}

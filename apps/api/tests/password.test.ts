import { describe, expect, it } from 'vitest';
import { hashPassword, validPassword, verifyPassword } from '../src/auth/password.js';
import { InMemoryUserRepository } from '../src/users/repository.js';

describe('verified email password credentials', () => {
  it('uses independent salts and rejects wrong, missing and malformed hashes', async () => {
    const password = 'correct horse battery staple';
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toEqual(second);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword('incorrect password', first)).toBe(false);
    expect(await verifyPassword(`${password}${'x'.repeat(200)}`, first)).toBe(false);
    expect(await verifyPassword(password)).toBe(false);
    expect(await verifyPassword(password, 'broken')).toBe(false);
    const maximumPassword = 'a'.repeat(128);
    const maximumHash = await hashPassword(maximumPassword);
    expect(await verifyPassword(maximumPassword + 'suffix', maximumHash)).toBe(false);
  });
  it('bounds passwords and binds credentials to the currently verified email', async () => {
    expect(validPassword('short')).toBe(false);
    expect(validPassword('é'.repeat(65))).toBe(false);
    const users = new InMemoryUserRepository();
    const user = await users.upsertFromGoogle({ sub: 'sub-one', email: 'Person@Example.com', name: 'Person' });
    expect(await users.setPassword(user.id, 'other@example.com', 'hash')).toBe(false);
    expect(await users.setPassword(user.id, 'person@example.com', 'hash')).toBe(true);
    expect((await users.findByVerifiedEmail('PERSON@EXAMPLE.COM'))?.passwordEmail).toBe('person@example.com');
    await users.upsertFromGoogle({ sub: 'sub-one', email: 'new@example.com', name: 'Person' });
    const changed = await users.findById(user.id);
    expect(changed?.passwordEmail).not.toBe(changed?.email);
  });
});

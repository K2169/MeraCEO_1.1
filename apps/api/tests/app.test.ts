import type { OAuth2Client, TokenPayload } from 'google-auth-library';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { createGoogleVerifier } from '../src/auth/google.js';
import { issueSessionToken } from '../src/auth/session.js';
import { InMemoryConsentRepository } from '../src/consent/repository.js';
import { InMemoryProfileRepository } from '../src/profiles/repository.js';
import { InMemoryNotificationRepository } from '../src/notifications/repository.js';
import { InMemorySavedRepository } from '../src/saved/repository.js';
import { InMemoryRequestRepository } from '../src/requests/repository.js';
import { InMemoryNeedRepository } from '../src/needs/repository.js';
import { buildUploadKey, UPLOAD_KINDS } from '../src/storage/presign.js';
import type { Storage } from '../src/storage/storage.js';
import { InMemoryUserRepository } from '../src/users/repository.js';

const SECRET = 'x'.repeat(40);
const GOOD_TOKEN = 'good-token-value-1234567890';

function googleClient(payload: Partial<TokenPayload>): OAuth2Client {
  return {
    verifyIdToken: async ({ idToken }: { idToken: string }) => {
      if (idToken !== GOOD_TOKEN) throw new Error('invalid');
      return { getPayload: () => payload as TokenPayload };
    },
  } as unknown as OAuth2Client;
}

// A pretend file store for tests: it hands out fake links and remembers what was deleted.
class FakeStorage implements Storage {
  removed: string[] = [];
  async createUploadUrl(req: { userId: string; kind: keyof typeof UPLOAD_KINDS; contentType: string }) {
    const key = buildUploadKey(req, 'abc-123');
    return key ? { uploadUrl: `https://files.test/upload/${key}`, key, expiresIn: 300 } : null;
  }
  async readUrl(key: string) {
    return `https://files.test/read/${key}`;
  }
  async remove(key: string) {
    this.removed.push(key);
  }
  async removePrefix(prefix: string) {
    this.removed.push(`${prefix}*`);
  }
}

const payload: Partial<TokenPayload> = {
  sub: 'google-sub-1',
  email: 'person@example.com',
  email_verified: true,
  iss: 'https://accounts.google.com',
  name: 'Test Person',
};

function makeApp() {
  const users = new InMemoryUserRepository();
  const consents = new InMemoryConsentRepository();
  const profiles = new InMemoryProfileRepository();
  const needs = new InMemoryNeedRepository();
  const storage = new FakeStorage();
  const requests = new InMemoryRequestRepository();
  const notifications = new InMemoryNotificationRepository();
  const saved = new InMemorySavedRepository();
  const app = buildApp(
    {
      sessionSecret: SECRET,
      verifyGoogle: createGoogleVerifier(['123-web.apps.googleusercontent.com'], googleClient(payload)),
      users,
      consents,
      profiles,
      needs,
      requests,
      notifications,
      saved,
      storage,
    },
    { logger: false },
  );
  return { app, users, consents, profiles, requests, saved, storage };
}

async function signIn(app: ReturnType<typeof makeApp>['app']) {
  const res = await app.inject({ method: 'POST', url: '/auth/google', payload: { idToken: GOOD_TOKEN } });
  return res.json() as { sessionToken: string; user: { id: string; name: string | null } };
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

describe('API routes', () => {
  let ctx: ReturnType<typeof makeApp>;

  beforeEach(() => {
    ctx = makeApp();
  });

  afterEach(async () => {
    await ctx.app.close();
  });

  it('GET /health answers without auth', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });

  it('POST /auth/google returns a session and never the email', async () => {
    const res = await ctx.app.inject({ method: 'POST', url: '/auth/google', payload: { idToken: GOOD_TOKEN } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.sessionToken).toEqual(expect.any(String));
    expect(body.user).toEqual({ id: expect.any(String), name: 'Test Person', role: null, ageConfirmed: null, dateOfBirthSet: false, profileComplete: false, moderation: null, photoUrl: null, consentDone: false });
    expect(JSON.stringify(body)).not.toContain('person@example.com');
  });

  it('POST /auth/google rejects an invalid Google token with 401', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/google',
      payload: { idToken: 'forged-token-value-000000000' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'invalid_token' });
  });

  it('POST /auth/google rejects a body without an idToken', async () => {
    const res = await ctx.app.inject({ method: 'POST', url: '/auth/google', payload: {} });
    expect(res.statusCode).toBe(400);
  });

  it('GET /me requires a valid session and rejects deleted users', async () => {
    expect((await ctx.app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401);
    const token = await issueSessionToken('ghost-user', SECRET);
    expect((await ctx.app.inject({ method: 'GET', url: '/me', headers: bearer(token) })).statusCode).toBe(401);
  });

  it('GET /me returns the signed-in user', async () => {
    const { sessionToken, user } = await signIn(ctx.app);
    const res = await ctx.app.inject({ method: 'GET', url: '/me', headers: bearer(sessionToken) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ id: user.id, name: 'Test Person', role: null, ageConfirmed: null, dateOfBirthSet: false, profileComplete: false, moderation: null, photoUrl: null, consentDone: false });
  });

  it('POST /me/role is refused until the age check is passed', async () => {
    const { sessionToken } = await signIn(ctx.app);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/me/role',
      headers: bearer(sessionToken),
      payload: { role: 'owner' },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ error: 'age_not_confirmed' });
  });

  it('POST /me/age confirms 18+ and then the role can be set once only', async () => {
    const { sessionToken } = await signIn(ctx.app);
    const age = await ctx.app.inject({
      method: 'POST',
      url: '/me/age',
      headers: bearer(sessionToken),
      payload: { dateOfBirth: '2000-01-02' },
    });
    expect(age.json()).toMatchObject({ ageConfirmed: true });
    expect(age.json()).not.toHaveProperty('dateOfBirth');
    const exported = await ctx.app.inject({ method: 'GET', url: '/me/export', headers: bearer(sessionToken) });
    expect(exported.json().account.dateOfBirth).toBe('2000-01-02');

    const first = await ctx.app.inject({
      method: 'POST',
      url: '/me/role',
      headers: bearer(sessionToken),
      payload: { role: 'professional' },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ role: 'professional' });

    const second = await ctx.app.inject({
      method: 'POST',
      url: '/me/role',
      headers: bearer(sessionToken),
      payload: { role: 'owner' },
    });
    expect(second.statusCode).toBe(409);
    expect(second.json()).toEqual({ error: 'role_already_set' });
  });

  it('a user under 18 is recorded as not confirmed and cannot pick a role', async () => {
    const { sessionToken } = await signIn(ctx.app);
    const age = await ctx.app.inject({
      method: 'POST',
      url: '/me/age',
      headers: bearer(sessionToken),
      payload: { dateOfBirth: '2015-10-10' },
    });
    expect(age.json()).toMatchObject({ ageConfirmed: false });
    const role = await ctx.app.inject({
      method: 'POST',
      url: '/me/role',
      headers: bearer(sessionToken),
      payload: { role: 'owner' },
    });
    expect(role.statusCode).toBe(403);
  });

  it('POST /me/age rejects impossible and future dates', async () => {
    const { sessionToken } = await signIn(ctx.app);
    for (const dateOfBirth of ['2001-02-29', '2099-01-01', '02/03/2000']) {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/me/age',
        headers: bearer(sessionToken),
        payload: { dateOfBirth },
      });
      expect(res.statusCode).toBe(400);
    }
  });

  it('POST /me/consents needs an adult and accepted terms, and stores one event per choice', async () => {
    const { sessionToken, user } = await signIn(ctx.app);
    await ctx.app.inject({ method: 'POST', url: '/me/age', headers: bearer(sessionToken), payload: { dateOfBirth: '2000-01-02' } });

    const noTerms = await ctx.app.inject({
      method: 'POST',
      url: '/me/consents',
      headers: bearer(sessionToken),
      payload: { consents: [{ type: 'matching', granted: true }] },
    });
    expect(noTerms.statusCode).toBe(400);
    expect(noTerms.json()).toEqual({ error: 'terms_required' });

    const ok = await ctx.app.inject({
      method: 'POST',
      url: '/me/consents',
      headers: bearer(sessionToken),
      payload: {
        consents: [
          { type: 'terms', granted: true },
          { type: 'matching', granted: false },
          { type: 'contact_sharing', granted: false },
          { type: 'notifications', granted: false },
        ],
      },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ recorded: 4 });
    const stored = await ctx.consents.listForUser(user.id);
    expect(stored).toHaveLength(4);
    expect(stored.every((e) => e.noticeVersion === 'draft-1')).toBe(true);
  });

  it('POST /uploads/presign returns a URL inside the caller folder', async () => {
    const { sessionToken, user } = await signIn(ctx.app);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/uploads/presign',
      headers: bearer(sessionToken),
      payload: { kind: 'logo', contentType: 'image/webp' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.key.startsWith(`${user.id}/logos/`)).toBe(true);
    expect(body.expiresIn).toBe(300);
  });

  it('POST /uploads/presign refuses disallowed types and anonymous callers', async () => {
    const anon = await ctx.app.inject({
      method: 'POST',
      url: '/uploads/presign',
      payload: { kind: 'logo', contentType: 'image/png' },
    });
    expect(anon.statusCode).toBe(401);

    const { sessionToken } = await signIn(ctx.app);
    const bad = await ctx.app.inject({
      method: 'POST',
      url: '/uploads/presign',
      headers: bearer(sessionToken),
      payload: { kind: 'logo', contentType: 'text/html' },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toEqual({ error: 'unsupported_file_type' });
  });

  // Signs in, confirms 18+ and picks a role, ready for profile tests.
  async function signInWithRole(role: 'owner' | 'professional') {
    const { sessionToken } = await signIn(ctx.app);
    await ctx.app.inject({ method: 'POST', url: '/me/age', headers: bearer(sessionToken), payload: { dateOfBirth: '2000-01-02' } });
    await ctx.app.inject({ method: 'POST', url: '/me/role', headers: bearer(sessionToken), payload: { role } });
    return sessionToken;
  }

  const ownerProfile = {
    businessName: 'Sharma Textiles',
    industry: 'retail',
    country: 'India',
    state: 'Gujarat',
    city: 'Surat',
    ownerName: 'Asha Sharma',
    businessType: 'private_limited',
    registrationType: 'gst_registered',
    description: 'We make and sell fabric through distributors across Gujarat.',
    revenue: '1_10_cr',
    teamSize: '11_50',
    designation: 'Founder',
    yearsInBusiness: 12,
    needTitle: 'Plan our first export order',
    challenge: 'We want to sell fabric abroad but do not know the paperwork or pricing.',
    needExpertise: ['international'],
    budgetBand: 'low',
  };

  it('PUT /me/profile saves a valid owner profile and marks the user complete', async () => {
    const token = await signInWithRole('owner');
    const res = await ctx.app.inject({ method: 'PUT', url: '/me/profile', headers: bearer(token), payload: ownerProfile });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ role: 'owner', profileComplete: true });

    const saved = await ctx.app.inject({ method: 'GET', url: '/me/profile', headers: bearer(token) });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().data).toMatchObject({ businessName: 'Sharma Textiles', city: 'Surat' });
  });

  it('PUT /me/profile rejects a bad form, a wrong-role form and anonymous callers', async () => {
    const token = await signInWithRole('owner');
    const bad = await ctx.app.inject({
      method: 'PUT',
      url: '/me/profile',
      headers: bearer(token),
      payload: { ...ownerProfile, businessName: 'x' },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.json()).toEqual({ error: 'invalid_profile' });

    // An owner cannot save a professional form.
    const wrongRole = await ctx.app.inject({
      method: 'PUT',
      url: '/me/profile',
      headers: bearer(token),
      payload: { name: 'Asha', country: 'India', city: 'Surat' },
    });
    expect(wrongRole.statusCode).toBe(400);

    expect((await ctx.app.inject({ method: 'PUT', url: '/me/profile', payload: ownerProfile })).statusCode).toBe(401);
  });

  it('PUT /me/profile needs a role first, and GET /me/profile is 404 before saving', async () => {
    const { sessionToken } = await signIn(ctx.app);
    await ctx.app.inject({ method: 'POST', url: '/me/age', headers: bearer(sessionToken), payload: { dateOfBirth: '2000-01-02' } });
    const noRole = await ctx.app.inject({
      method: 'PUT',
      url: '/me/profile',
      headers: bearer(sessionToken),
      payload: ownerProfile,
    });
    expect(noRole.statusCode).toBe(403);
    expect(noRole.json()).toEqual({ error: 'role_not_set' });
    const none = await ctx.app.inject({ method: 'GET', url: '/me/profile', headers: bearer(sessionToken) });
    expect(none.statusCode).toBe(404);
  });

  it('consentDone turns true once the terms are accepted', async () => {
    const token = await signInWithRole('owner');
    const before = await ctx.app.inject({ method: 'GET', url: '/me', headers: bearer(token) });
    expect(before.json().consentDone).toBe(false);
    await ctx.app.inject({
      method: 'POST',
      url: '/me/consents',
      headers: bearer(token),
      payload: { consents: [{ type: 'terms', granted: true }] },
    });
    const after = await ctx.app.inject({ method: 'GET', url: '/me', headers: bearer(token) });
    expect(after.json().consentDone).toBe(true);
  });

  const proProfile = {
    name: 'Ravi Menon',
    country: 'India',
    state: 'Karnataka',
    city: 'Bengaluru',
    headline: 'Helps shops grow online',
    designation: 'Independent consultant',
    company: 'Menon Growth Advisory',
    yearsExperience: 10,
    employmentType: 'independent',
    qualification: 'mba',
    skills: ['E-commerce', 'Retail growth'],
    engagementType: 'both',
    days: ['mon', 'tue', 'wed'],
    experience: 'Ten years of growing retail brands through marketing and sales.',
    expertise: ['marketing', 'sales'],
    industry: 'retail',
    feeBand: 'low',
    formats: ['online'],
    disclaimerAccepted: true,
    termsAccepted: true,
  };

  it('saving an owner profile creates the first need once', async () => {
    const token = await signInWithRole('owner');
    await ctx.app.inject({ method: 'PUT', url: '/me/profile', headers: bearer(token), payload: ownerProfile });
    await ctx.app.inject({ method: 'PUT', url: '/me/profile', headers: bearer(token), payload: ownerProfile });
    const res = await ctx.app.inject({ method: 'GET', url: '/me/needs', headers: bearer(token) });
    expect(res.json().needs).toHaveLength(1);
    expect(res.json().needs[0]).toMatchObject({ title: 'Plan our first export order', status: 'open' });
  });

  it('POST /me/needs adds a need for owners only and rejects a bad form', async () => {
    const owner = await signInWithRole('owner');
    const ok = await ctx.app.inject({
      method: 'POST',
      url: '/me/needs',
      headers: bearer(owner),
      payload: { title: 'Grow online sales', challenge: 'We sell in one shop and want an online store.', expertise: ['marketing'], industry: 'retail', budgetBand: 'mid' },
    });
    expect(ok.statusCode).toBe(201);
    const bad = await ctx.app.inject({ method: 'POST', url: '/me/needs', headers: bearer(owner), payload: { title: 'x' } });
    expect(bad.statusCode).toBe(400);
    expect((await ctx.app.inject({ method: 'POST', url: '/me/needs', payload: {} })).statusCode).toBe(401);
  });

  it('matches only show approved professionals, ranked, without contact details', async () => {
    // A professional saves a profile. They wait for review, so no matches yet.
    const { sessionToken: proToken, user: proUser } = await signIn(ctx.app);
    await ctx.app.inject({ method: 'POST', url: '/me/age', headers: bearer(proToken), payload: { dateOfBirth: '2000-01-02' } });
    await ctx.app.inject({ method: 'POST', url: '/me/role', headers: bearer(proToken), payload: { role: 'professional' } });
    await ctx.app.inject({ method: 'PUT', url: '/me/profile', headers: bearer(proToken), payload: proProfile });

    // A second Google account is needed for the owner, so build one directly.
    const ownerUser = await ctx.users.upsertFromGoogle({ sub: 'google-sub-2', email: 'owner@example.com', name: 'Owner' });
    await ctx.users.setDateOfBirth(ownerUser.id, '2000-01-02', true);
    await ctx.users.setRoleOnce(ownerUser.id, 'owner');
    const ownerToken = await issueSessionToken(ownerUser.id, SECRET);
    await ctx.app.inject({
      method: 'POST',
      url: '/me/needs',
      headers: bearer(ownerToken),
      payload: { title: 'Grow online sales', challenge: 'We sell in one shop and want an online store.', expertise: ['marketing', 'sales'], industry: 'retail', budgetBand: 'mid', format: 'online' },
    });
    const needId = (await ctx.app.inject({ method: 'GET', url: '/me/needs', headers: bearer(ownerToken) })).json().needs[0].id;

    const before = await ctx.app.inject({ method: 'GET', url: `/me/needs/${needId}/matches`, headers: bearer(ownerToken) });
    expect(before.json().matches).toEqual([]);

    ctx.profiles.approve(proUser.id);
    const after = await ctx.app.inject({ method: 'GET', url: `/me/needs/${needId}/matches`, headers: bearer(ownerToken) });
    expect(after.statusCode).toBe(200);
    const [match] = after.json().matches;
    expect(match).toMatchObject({ id: proUser.id, name: 'Ravi Menon', score: 100, reasons: ['expertise', 'industry', 'budget', 'format'] });
    expect(JSON.stringify(after.json())).not.toMatch(/example\.com/);

    // Another owner cannot read this need's matches.
    const otherUser = await ctx.users.upsertFromGoogle({ sub: 'google-sub-3', email: 'other@example.com', name: 'Other' });
    await ctx.users.setDateOfBirth(otherUser.id, '2000-01-02', true);
    await ctx.users.setRoleOnce(otherUser.id, 'owner');
    const other = await issueSessionToken(otherUser.id, SECRET);
    const denied = await ctx.app.inject({ method: 'GET', url: `/me/needs/${needId}/matches`, headers: bearer(other) });
    expect(denied.statusCode).toBe(404);
  });

  // Makes a signed-in user with a role without going through Google, for tests with two people.
  async function makeUser(sub: string, role: 'owner' | 'professional') {
    const user = await ctx.users.upsertFromGoogle({ sub, email: `${sub}@example.com`, name: sub });
    await ctx.users.setDateOfBirth(user.id, '2000-01-02', true);
    await ctx.users.setRoleOnce(user.id, role);
    return { id: user.id, token: await issueSessionToken(user.id, SECRET) };
  }

  // Sets up an approved professional and an owner with one open need.
  async function requestSetup() {
    const pro = await makeUser('pro-1', 'professional');
    await ctx.app.inject({ method: 'PUT', url: '/me/profile', headers: bearer(pro.token), payload: proProfile });
    ctx.profiles.approve(pro.id);
    const owner = await makeUser('owner-1', 'owner');
    await ctx.app.inject({ method: 'PUT', url: '/me/profile', headers: bearer(owner.token), payload: { ...ownerProfile, needExpertise: ['marketing'] } });
    const needId = (await ctx.app.inject({ method: 'GET', url: '/me/needs', headers: bearer(owner.token) })).json().needs[0].id as string;
    return { pro, owner, needId };
  }

  it('an owner sends a request, both sides see it, and a duplicate is refused', async () => {
    const { pro, owner, needId } = await requestSetup();
    const sent = await ctx.app.inject({ method: 'POST', url: '/me/requests', headers: bearer(owner.token), payload: { needId, professionalId: pro.id, note: 'Can we talk this week?' } });
    expect(sent.statusCode).toBe(201);
    expect(sent.json()).toMatchObject({ status: 'pending', professional: { name: 'Ravi Menon' } });

    const dup = await ctx.app.inject({ method: 'POST', url: '/me/requests', headers: bearer(owner.token), payload: { needId, professionalId: pro.id } });
    expect(dup.statusCode).toBe(409);

    const ownerList = (await ctx.app.inject({ method: 'GET', url: '/me/requests', headers: bearer(owner.token) })).json().requests;
    expect(ownerList).toHaveLength(1);
    const proList = (await ctx.app.inject({ method: 'GET', url: '/me/requests', headers: bearer(pro.token) })).json();
    expect(proList.requests[0]).toMatchObject({ note: 'Can we talk this week?', owner: { businessName: 'Sharma Textiles' }, need: { title: 'Plan our first export order' } });
    expect(JSON.stringify(proList)).not.toMatch(/example\.com/);

    // The matches list now shows the request status.
    const matches = (await ctx.app.inject({ method: 'GET', url: `/me/needs/${needId}/matches`, headers: bearer(owner.token) })).json().matches;
    expect(matches[0].requestStatus).toBe('pending');
  });

  it('only owners can send, and only to approved professionals about their own open needs', async () => {
    const { pro, owner, needId } = await requestSetup();
    const asPro = await ctx.app.inject({ method: 'POST', url: '/me/requests', headers: bearer(pro.token), payload: { needId, professionalId: pro.id } });
    expect(asPro.statusCode).toBe(403);
    const stranger = await makeUser('owner-2', 'owner');
    const notMine = await ctx.app.inject({ method: 'POST', url: '/me/requests', headers: bearer(stranger.token), payload: { needId, professionalId: pro.id } });
    expect(notMine.statusCode).toBe(404);
    const ghost = await ctx.app.inject({ method: 'POST', url: '/me/requests', headers: bearer(owner.token), payload: { needId, professionalId: 'nobody' } });
    expect(ghost.statusCode).toBe(404);
  });

  it('the professional accepts, the owner cannot, and outsiders cannot see the request', async () => {
    const { pro, owner, needId } = await requestSetup();
    const id = (await ctx.app.inject({ method: 'POST', url: '/me/requests', headers: bearer(owner.token), payload: { needId, professionalId: pro.id } })).json().id as string;
    const url = `/me/requests/${id}/action`;

    const byOwner = await ctx.app.inject({ method: 'POST', url, headers: bearer(owner.token), payload: { action: 'accept' } });
    expect(byOwner.statusCode).toBe(403);
    const outsider = await makeUser('pro-2', 'professional');
    expect((await ctx.app.inject({ method: 'POST', url, headers: bearer(outsider.token), payload: { action: 'accept' } })).statusCode).toBe(404);

    const accepted = await ctx.app.inject({ method: 'POST', url, headers: bearer(pro.token), payload: { action: 'accept' } });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().status).toBe('accepted');

    // An accepted request cannot be declined, but either side may cancel it.
    expect((await ctx.app.inject({ method: 'POST', url, headers: bearer(pro.token), payload: { action: 'decline' } })).statusCode).toBe(409);
    const cancelled = await ctx.app.inject({ method: 'POST', url, headers: bearer(owner.token), payload: { action: 'cancel' } });
    expect(cancelled.json().status).toBe('cancelled');
  });

  it('a declined request lets the owner send a fresh one', async () => {
    const { pro, owner, needId } = await requestSetup();
    const first = (await ctx.app.inject({ method: 'POST', url: '/me/requests', headers: bearer(owner.token), payload: { needId, professionalId: pro.id } })).json().id as string;
    await ctx.app.inject({ method: 'POST', url: `/me/requests/${first}/action`, headers: bearer(pro.token), payload: { action: 'decline' } });
    const again = await ctx.app.inject({ method: 'POST', url: '/me/requests', headers: bearer(owner.token), payload: { needId, professionalId: pro.id } });
    expect(again.statusCode).toBe(201);
  });

  it('GET /me/consents shows the latest choice, and optional choices can be changed later', async () => {
    const token = await signInWithRole('owner');
    const first = await ctx.app.inject({ method: 'GET', url: '/me/consents', headers: bearer(token) });
    expect(first.json().choices).toEqual({ matching: null, contact_sharing: null, notifications: null, terms: null });

    await ctx.app.inject({ method: 'POST', url: '/me/consents', headers: bearer(token), payload: { consents: [{ type: 'terms', granted: true }, { type: 'matching', granted: true }] } });
    // Later changes do not need to repeat the terms.
    const change = await ctx.app.inject({ method: 'POST', url: '/me/consents', headers: bearer(token), payload: { consents: [{ type: 'matching', granted: false }] } });
    expect(change.statusCode).toBe(200);
    const now = await ctx.app.inject({ method: 'GET', url: '/me/consents', headers: bearer(token) });
    expect(now.json().choices).toMatchObject({ matching: false, terms: true });

    // Terms cannot be withdrawn this way.
    const withdraw = await ctx.app.inject({ method: 'POST', url: '/me/consents', headers: bearer(token), payload: { consents: [{ type: 'terms', granted: false }] } });
    expect(withdraw.statusCode).toBe(400);
  });

  it('a professional who turns off match suggestions disappears from matches', async () => {
    const { pro, owner, needId } = await requestSetup();
    const url = `/me/needs/${needId}/matches`;
    expect((await ctx.app.inject({ method: 'GET', url, headers: bearer(owner.token) })).json().matches).toHaveLength(1);
    await ctx.app.inject({ method: 'POST', url: '/me/consents', headers: bearer(pro.token), payload: { consents: [{ type: 'terms', granted: true }, { type: 'matching', granted: false }] } });
    expect((await ctx.app.inject({ method: 'GET', url, headers: bearer(owner.token) })).json().matches).toHaveLength(0);
  });

  it('a professional who opts out cannot be opened or saved and is removed from saved lists', async () => {
    const { pro, owner } = await requestSetup();
    const ownerAuth = { headers: bearer(owner.token) };
    const savedUrl = `/me/saved/${pro.id}`;

    expect((await ctx.app.inject({ method: 'PUT', url: savedUrl, ...ownerAuth })).statusCode).toBe(204);
    expect((await ctx.app.inject({ method: 'GET', url: '/me/professionals?saved=true', ...ownerAuth })).json().professionals).toHaveLength(1);

    const optedOut = await ctx.app.inject({
      method: 'POST',
      url: '/me/consents',
      headers: bearer(pro.token),
      payload: { consents: [{ type: 'terms', granted: true }, { type: 'matching', granted: false }] },
    });
    expect(optedOut.statusCode).toBe(200);
    expect((await ctx.app.inject({ method: 'GET', url: `/me/professionals/${pro.id}`, ...ownerAuth })).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: 'PUT', url: savedUrl, ...ownerAuth })).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: 'GET', url: '/me/professionals?saved=true', ...ownerAuth })).json().professionals).toHaveLength(0);
    expect((await ctx.app.inject({ method: 'GET', url: '/me/export', ...ownerAuth })).json().savedProfessionals).toEqual([]);
  });

  it('GET /me/export returns the person\'s own data only', async () => {
    const { pro, owner } = await requestSetup();
    const res = await ctx.app.inject({ method: 'GET', url: '/me/export', headers: bearer(owner.token) });
    expect(res.statusCode).toBe(200);
    const data = res.json();
    expect(data.account.id).toBe(owner.id);
    expect(data.profile.data.businessName).toBe('Sharma Textiles');
    expect(data.needs).toHaveLength(1);
    expect(JSON.stringify(data)).not.toContain(pro.id);
    expect((await ctx.app.inject({ method: 'GET', url: '/me/export' })).statusCode).toBe(401);
  });

  it('DELETE /me removes the account, its profile, needs and requests, and the token stops working', async () => {
    const { pro, owner, needId } = await requestSetup();
    await ctx.app.inject({ method: 'POST', url: '/me/requests', headers: bearer(owner.token), payload: { needId, professionalId: pro.id } });
    const del = await ctx.app.inject({ method: 'DELETE', url: '/me', headers: bearer(owner.token) });
    expect(del.statusCode).toBe(204);
    expect((await ctx.app.inject({ method: 'GET', url: '/me', headers: bearer(owner.token) })).statusCode).toBe(401);
    // The professional no longer has the request, and the other person's data is untouched.
    expect((await ctx.app.inject({ method: 'GET', url: '/me/requests', headers: bearer(pro.token) })).json().requests).toHaveLength(0);
    expect((await ctx.app.inject({ method: 'GET', url: '/me/profile', headers: bearer(pro.token) })).statusCode).toBe(200);
  });

  it('GET /me/opportunities lists fitting open needs for professionals only', async () => {
    const { pro, owner } = await requestSetup();
    const feed = await ctx.app.inject({ method: 'GET', url: '/me/opportunities', headers: bearer(pro.token) });
    expect(feed.statusCode).toBe(200);
    expect(feed.json().opportunities[0]).toMatchObject({ title: 'Plan our first export order', business: { name: 'Sharma Textiles' } });
    expect(JSON.stringify(feed.json())).not.toMatch(/example\.com/);
    expect((await ctx.app.inject({ method: 'GET', url: '/me/opportunities', headers: bearer(owner.token) })).statusCode).toBe(403);
  });

  it('GET /me/professionals searches, filters and ranks, and lists people who do not fit below those who do', async () => {
    const { pro, owner } = await requestSetup();
    const get = async (qs: string) => (await ctx.app.inject({ method: 'GET', url: `/me/professionals${qs}`, headers: bearer(owner.token) })).json().professionals as { name: string; score: number }[];

    expect((await get(''))[0]).toMatchObject({ id: pro.id, name: 'Ravi Menon' });
    expect(await get('?q=ravi')).toHaveLength(1);
    expect(await get('?q=bengaluru')).toHaveLength(1);
    expect(await get('?q=nobody')).toHaveLength(0);
    expect(await get('?expertise=legal')).toHaveLength(0);
    expect(await get('?industry=retail&format=online')).toHaveLength(1);
    expect(await get('?format=phone')).toHaveLength(0);

    // A second professional with no matching expertise still shows, after the good fit.
    const other = await makeUser('pro-3', 'professional');
    await ctx.app.inject({ method: 'PUT', url: '/me/profile', headers: bearer(other.token), payload: { ...proProfile, name: 'Zed Legal', expertise: ['legal'] } });
    ctx.profiles.approve(other.id);
    const all = await get('');
    expect(all.map((p) => p.name)).toEqual(['Ravi Menon', 'Zed Legal']);
    expect(all[1]!.score).toBe(0);

    expect((await ctx.app.inject({ method: 'GET', url: '/me/professionals?expertise=bogus', headers: bearer(owner.token) })).statusCode).toBe(400);
    expect((await ctx.app.inject({ method: 'GET', url: '/me/professionals', headers: bearer(pro.token) })).statusCode).toBe(403);
  });

  it('GET /me/professionals/:id opens an approved profile for owners, without contact details', async () => {
    const { pro, owner } = await requestSetup();
    const res = await ctx.app.inject({ method: 'GET', url: `/me/professionals/${pro.id}`, headers: bearer(owner.token) });
    expect(res.statusCode).toBe(200);
    expect(res.json().professional).toMatchObject({ id: pro.id, name: 'Ravi Menon' });
    expect(Array.isArray(res.json().needs)).toBe(true);
    expect(JSON.stringify(res.json())).not.toMatch(/phone|linkedin|example\.com/i);

    // Not found for a person who is not an approved professional, and closed to professionals.
    expect((await ctx.app.inject({ method: 'GET', url: `/me/professionals/${owner.id}`, headers: bearer(owner.token) })).statusCode).toBe(404);
    expect((await ctx.app.inject({ method: 'GET', url: `/me/professionals/${pro.id}`, headers: bearer(pro.token) })).statusCode).toBe(403);
  });

  it('owners can save and unsave approved professionals, and filter the search to saved ones', async () => {
    const { pro, owner } = await requestSetup();
    const auth = { headers: bearer(owner.token) };
    const list = async (qs = '') => (await ctx.app.inject({ method: 'GET', url: `/me/professionals${qs}`, ...auth })).json().professionals as { id: string; saved: boolean }[];

    expect((await list())[0]).toMatchObject({ id: pro.id, saved: false });
    expect(await list('?saved=true')).toHaveLength(0);

    expect((await ctx.app.inject({ method: 'PUT', url: `/me/saved/${pro.id}`, ...auth })).statusCode).toBe(204);
    expect((await ctx.app.inject({ method: 'PUT', url: `/me/saved/${pro.id}`, ...auth })).statusCode).toBe(204); // saving twice is fine
    expect((await list())[0]).toMatchObject({ id: pro.id, saved: true });
    expect(await list('?saved=true')).toHaveLength(1);
    expect((await ctx.app.inject({ method: 'GET', url: `/me/professionals/${pro.id}`, ...auth })).json().saved).toBe(true);

    expect((await ctx.app.inject({ method: 'DELETE', url: `/me/saved/${pro.id}`, ...auth })).statusCode).toBe(204);
    expect(await list('?saved=true')).toHaveLength(0);

    // Only owners can save, and only real approved professionals.
    expect((await ctx.app.inject({ method: 'PUT', url: `/me/saved/${pro.id}`, headers: bearer(pro.token) })).statusCode).toBe(403);
    expect((await ctx.app.inject({ method: 'PUT', url: `/me/saved/${owner.id}`, ...auth })).statusCode).toBe(404);
  });

  it('the opportunity feed can be searched and filtered', async () => {
    const { pro } = await requestSetup();
    const get = async (qs: string) => (await ctx.app.inject({ method: 'GET', url: `/me/opportunities${qs}`, headers: bearer(pro.token) })).json().opportunities as unknown[];
    expect(await get('')).toHaveLength(1);
    expect(await get('?q=export')).toHaveLength(1);
    expect(await get('?q=zzz')).toHaveLength(0);
    expect(await get('?industry=healthcare')).toHaveLength(0);
  });

  it('requests create notifications for the other person, which can be read and marked read', async () => {
    const { pro, owner, needId } = await requestSetup();
    const sent = await ctx.app.inject({ method: 'POST', url: '/me/requests', headers: bearer(owner.token), payload: { needId, professionalId: pro.id } });
    const requestId = sent.json().id as string;

    // The professional is told about the request; the owner has nothing yet.
    const proList = (await ctx.app.inject({ method: 'GET', url: '/me/notifications', headers: bearer(pro.token) })).json();
    expect(proList.unread).toBe(1);
    expect(proList.notifications[0]).toMatchObject({ type: 'request_received', actorName: 'Asha Sharma', needTitle: 'Plan our first export order' });
    expect((await ctx.app.inject({ method: 'GET', url: '/me/notifications/unread', headers: bearer(owner.token) })).json()).toEqual({ unread: 0 });

    // The professional accepts, so the owner is told.
    await ctx.app.inject({ method: 'POST', url: `/me/requests/${requestId}/action`, headers: bearer(pro.token), payload: { action: 'accept' } });
    const ownerList = (await ctx.app.inject({ method: 'GET', url: '/me/notifications', headers: bearer(owner.token) })).json();
    expect(ownerList.notifications[0]).toMatchObject({ type: 'request_accepted', actorName: 'Ravi Menon' });

    // Opening the list marks everything read.
    await ctx.app.inject({ method: 'POST', url: '/me/notifications/read', headers: bearer(pro.token) });
    expect((await ctx.app.inject({ method: 'GET', url: '/me/notifications/unread', headers: bearer(pro.token) })).json()).toEqual({ unread: 0 });
    expect((await ctx.app.inject({ method: 'GET', url: '/me/notifications' })).statusCode).toBe(401);
  });

  it('either person can schedule an accepted consultation, and completing waits for the start time', async () => {
    const { pro, owner, needId } = await requestSetup();
    const id = (await ctx.app.inject({ method: 'POST', url: '/me/requests', headers: bearer(owner.token), payload: { needId, professionalId: pro.id } })).json().id as string;
    const schedule = (token: string, startsAt: string) => ctx.app.inject({ method: 'POST', url: `/me/requests/${id}/schedule`, headers: bearer(token), payload: { startsAt } });
    const inTwoDays = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();

    // Not accepted yet.
    expect((await schedule(owner.token, inTwoDays)).statusCode).toBe(409);
    await ctx.app.inject({ method: 'POST', url: `/me/requests/${id}/action`, headers: bearer(pro.token), payload: { action: 'accept' } });

    // Bad times and outsiders are refused.
    expect((await schedule(owner.token, new Date(Date.now() - 3600 * 1000).toISOString())).statusCode).toBe(400);
    expect((await schedule(owner.token, new Date(Date.now() + 200 * 24 * 3600 * 1000).toISOString())).statusCode).toBe(400);
    const outsider = await makeUser('owner-9', 'owner');
    expect((await schedule(outsider.token, inTwoDays)).statusCode).toBe(404);

    // The owner sets a time and the professional is told.
    const ok = await schedule(owner.token, inTwoDays);
    expect(ok.statusCode).toBe(200);
    expect(ok.json().scheduledAt).toBe(inTwoDays);
    const types = (await ctx.app.inject({ method: 'GET', url: '/me/notifications', headers: bearer(pro.token) })).json().notifications.map((n: { type: string }) => n.type);
    expect(types).toContain('consultation_scheduled');

    // It cannot be completed before it starts.
    const early = await ctx.app.inject({ method: 'POST', url: `/me/requests/${id}/action`, headers: bearer(owner.token), payload: { action: 'complete' } });
    expect(early.statusCode).toBe(409);
    expect(early.json()).toEqual({ error: 'REQUEST_NOT_YET_STARTED' });

    // Once the time has passed it can be completed, and the other person is told.
    await ctx.requests.setSchedule(id, new Date(Date.now() - 60 * 1000));
    const done = await ctx.app.inject({ method: 'POST', url: `/me/requests/${id}/action`, headers: bearer(pro.token), payload: { action: 'complete' } });
    expect(done.statusCode).toBe(200);
    expect(done.json().status).toBe('completed');
    const ownerTypes = (await ctx.app.inject({ method: 'GET', url: '/me/notifications', headers: bearer(owner.token) })).json().notifications.map((n: { type: string }) => n.type);
    expect(ownerTypes).toContain('consultation_completed');
  });

  it('a person can add and remove their photo, and others see it through short-lived links', async () => {
    const { pro, owner, needId } = await requestSetup();
    const presign = await ctx.app.inject({ method: 'POST', url: '/uploads/presign', headers: bearer(pro.token), payload: { kind: 'photo', contentType: 'image/jpeg' } });
    expect(presign.statusCode).toBe(200);
    const key = presign.json().key as string;
    expect(key).toBe(`${pro.id}/photos/abc-123.jpg`);

    // The wrong person's folder, or the wrong kind of file for the role, is refused.
    const bad = (k: string) => ctx.app.inject({ method: 'PUT', url: '/me/photo', headers: bearer(pro.token), payload: { key: k } });
    expect((await bad(`${owner.id}/photos/abc-123.jpg`)).statusCode).toBe(400);
    expect((await bad(`${pro.id}/logos/abc-123.jpg`)).statusCode).toBe(400);
    expect((await bad(`${pro.id}/photos/abc-123.exe`)).statusCode).toBe(400);

    const saved = await ctx.app.inject({ method: 'PUT', url: '/me/photo', headers: bearer(pro.token), payload: { key } });
    expect(saved.json().photoUrl).toBe(`https://files.test/read/${key}`);

    // The owner sees it in search results and in the request.
    const found = (await ctx.app.inject({ method: 'GET', url: '/me/professionals', headers: bearer(owner.token) })).json().professionals[0];
    expect(found.photoUrl).toBe(`https://files.test/read/${key}`);
    await ctx.app.inject({ method: 'POST', url: '/me/requests', headers: bearer(owner.token), payload: { needId, professionalId: pro.id } });
    const mine = (await ctx.app.inject({ method: 'GET', url: '/me/requests', headers: bearer(owner.token) })).json().requests[0];
    expect(mine.professional.photoUrl).toBe(`https://files.test/read/${key}`);

    // Removing it deletes the file and clears the link.
    const removed = await ctx.app.inject({ method: 'DELETE', url: '/me/photo', headers: bearer(pro.token) });
    expect(removed.json().photoUrl).toBeNull();
    expect(ctx.storage.removed).toContain(key);
  });

  it('deleting an account removes the person\'s stored files', async () => {
    const { owner } = await requestSetup();
    await ctx.app.inject({ method: 'DELETE', url: '/me', headers: bearer(owner.token) });
    expect(ctx.storage.removed).toContain(`${owner.id}/*`);
  });
});

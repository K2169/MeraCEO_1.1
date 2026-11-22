import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import Fastify from 'fastify';
import {
  EXPERTISE_IDS,
  DAYS,
  FEE_BANDS,
  FORMATS,
  INDUSTRY_IDS,
  hasContactInformation,
  createNeedSchema,
  createRequestSchema,
  isWithinAvailability,
  transitionRequest,
  REQUEST_ERROR_CODES,
  type OwnerOnboarding,
  matchProfessional,
  ownerOnboardingSchema,
  ownerRegistrationSchema,
  professionalOnboardingSchema,
  professionalRegistrationSchema,
  rankMatches,
  type ProfessionalOnboarding,
} from '@meraceo/shared';
import { z } from 'zod';

import { AuthError, type GoogleVerifier } from './auth/google.js';
import { hashPassword, validPassword, verifyPassword } from './auth/password.js';
import { issueSessionToken, verifySessionToken } from './auth/session.js';
import { CONSENT_TYPES, type ConsentEvent, type ConsentRepository } from './consent/repository.js';
import type { NotificationRepository, NotificationType } from './notifications/repository.js';
import type { SavedRepository } from './saved/repository.js';
import { DuplicateNeedError, type NeedRecord, type NeedRepository } from './needs/repository.js';
import { ActiveRequestExistsError, LegacyScheduleError, SlotConflictError, type RequestRecord, type RequestRepository } from './requests/repository.js';
import type { ProfileRepository } from './profiles/repository.js';
import { UPLOAD_KINDS } from './storage/presign.js';
import type { Storage } from './storage/storage.js';
import { validUploadedImage } from './storage/validate-upload.js';
import { RoleAlreadySetError, type UserRecord, type UserRepository } from './users/repository.js';
import type { GrievanceRepository } from './grievances/repository.js';
import { registerGrievanceRoutes } from './grievances/routes.js';
import type { CallRecord, CallRepository, CallStatus } from './calls/repository.js';
import type { MessageRepository } from './messages/repository.js';

// agora-token is CommonJS; load it with Node's interop helper instead of synthetic ESM named imports.
const agoraToken = createRequire(import.meta.url)('agora-token') as typeof import('agora-token');

export interface AppDeps {
  sessionSecret: string;
  verifyGoogle: GoogleVerifier;
  users: UserRepository;
  consents: ConsentRepository;
  profiles: ProfileRepository;
  needs: NeedRepository;
  requests: RequestRepository;
  messages: MessageRepository;
  calls?: CallRepository;
  agora?: { appId: string; appCertificate: string } | null;
  notifications: NotificationRepository;
  saved: SavedRepository;
  storage: Storage;
  grievances?: GrievanceRepository;
  supportEmail?: string;
}

// Version of the privacy notice the app shows. Bump it when W3-06 approves new wording.
export const NOTICE_VERSION = 'draft-1';

// Owners see a display alias only when the Professional explicitly enabled discreet mode.
// Legacy profiles without these fields preserve their existing full-name behavior.
function professionalPublicName(profile: Pick<ProfessionalOnboarding, 'name' | 'displayName' | 'discreetMode'>): string {
  return profile.discreetMode && profile.displayName?.trim() ? profile.displayName.trim() : profile.name;
}

const googleBody = z.object({ idToken: z.string().min(20).max(4096) });
const passwordLoginBody = z.object({ identifier: z.string().trim().min(3).max(254), password: z.string().min(1).max(256) });
const passwordSetupBody = z.object({ password: z.string().min(12).max(128) });
const presignBody = z.object({
  kind: z.enum(Object.keys(UPLOAD_KINDS) as [keyof typeof UPLOAD_KINDS, ...(keyof typeof UPLOAD_KINDS)[]]),
  contentType: z.string().max(100),
});
const actionBody = z.object({ action: z.enum(['accept', 'decline', 'cancel', 'complete']) });
const messageBody = z.object({ body: z.string().trim().min(1).max(2000) });
const scheduleBody = z.object({ startsAt: z.string().datetime(), proposalId: z.string().uuid().optional() });
// Search and filters for the Discover tab and the opportunity feed. Every part is optional.
const searchQuery = z.object({
  q: z.string().trim().max(80).optional(),
  expertise: z.enum(EXPERTISE_IDS).optional(),
  industry: z.enum(INDUSTRY_IDS).optional(),
  // Professionals whose fee band is this or lower.
  fee: z.enum(FEE_BANDS).optional(),
  format: z.enum(FORMATS).optional(),
  // Rank by one of the owner's needs. Without it, the best fit across all their open needs is used.
  needId: z.string().max(64).optional(),
  // Only the professionals the owner has saved.
  saved: z.enum(['true']).optional(),
  // Show professionals who have a complete, structured consultation schedule.
  availability: z.enum(['configured']).optional(),
});
// True when every word typed appears somewhere in the text (case does not matter).
const matchesText = (text: string, query: string) => query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => text.toLowerCase().includes(word));

function publicNeed(need: NeedRecord): Omit<NeedRecord, 'dedupeKey'> {
  const result = { ...need };
  delete result.dedupeKey;
  return result;
}

function hasConfiguredAvailability(profile: Pick<ProfessionalOnboarding, 'availabilityWindows' | 'timezone' | 'durationMinutes'>): boolean {
  if (!profile.timezone || !profile.durationMinutes || !Number.isInteger(profile.durationMinutes) || profile.durationMinutes <= 0) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: profile.timezone }); } catch { return false; }
  const windows = profile.availabilityWindows;
  if (!Array.isArray(windows) || windows.length === 0) return false;
  return windows.every(({ day, startTime, endTime }) => DAYS.includes(day)
    && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime)
    && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(endTime)
    && endTime > startTime);
}

type ThrottleBucket = { count: number; resetAt: number };
function consumePasswordAttempt(buckets: Map<string, ThrottleBucket>, key: string, now: number): boolean {
  for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey);
  const current = buckets.get(key);
  if (current && current.count >= 10) return false;
  if (!current) {
    // Cap distinct principals so rotating source addresses cannot grow this process-local throttle forever.
    if (buckets.size >= 10_000) return false;
    buckets.set(key, { count: 1, resetAt: now + 15 * 60_000 });
  } else current.count += 1;
  return true;
}

const photoBody = z.object({ key: z.string().min(10).max(200) });
const roleBody = z.object({ role: z.enum(['owner', 'professional']) });
const ageBody = z.object({ dateOfBirth: z.string().refine(isValidDateOfBirth) });
const consentBody = z.object({
  // Re-used on every retry of the same onboarding submission. Later preference changes
  // must use a new key so the consent log remains append-only.
  idempotencyKey: z.string().min(16).max(128).optional(),
  consents: z
    .array(z.object({ type: z.enum(CONSENT_TYPES), granted: z.boolean() }))
    .min(1)
    .max(CONSENT_TYPES.length),
}).superRefine(({ consents }, ctx) => {
  const seen = new Set<string>();
  for (const [index, choice] of consents.entries()) {
    if (seen.has(choice.type)) {
      ctx.addIssue({ code: 'custom', path: ['consents', index, 'type'], message: 'Consent type can appear only once' });
    }
    seen.add(choice.type);
  }
});

// The latest choice for each consent type, from the full history. A type never answered is null.
function latestChoices(events: ConsentEvent[]): Record<(typeof CONSENT_TYPES)[number], boolean | null> {
  const result = { matching: null, contact_sharing: null, notifications: null, terms: null } as Record<(typeof CONSENT_TYPES)[number], boolean | null>;
  // Events arrive oldest first, so later ones overwrite earlier ones.
  for (const event of events) result[event.consentType] = event.granted;
  return result;
}

// Accepts real ISO calendar dates that are not in the future.
function isValidDateOfBirth(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= new Date().toISOString().slice(0, 10);
}

// Determines whether a date of birth reaches 18 on the current UTC date.
function isAtLeast18(dateOfBirth: string, now: Date): boolean {
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  let age = now.getUTCFullYear() - year!;
  if (now.getUTCMonth() + 1 < month! || (now.getUTCMonth() + 1 === month! && now.getUTCDate() < day!)) age -= 1;
  return age >= 18;
}

// Builds the web server and registers every route. Takes the services it needs as inputs.
export function buildApp(deps: AppDeps, options: { logger?: boolean } = {}) {
  // Never log tokens or request bodies (plan rule 4).
  const app = Fastify({
    logger: options.logger === false ? false : { redact: ['req.headers.authorization', 'req.body.idToken', 'req.body.dateOfBirth', 'req.body.password', 'req.body.identifier', 'req.body.body'] },
  });

  async function userIdFromHeader(authorization: string | undefined): Promise<string | null> {
    const match = authorization?.match(/^Bearer (.+)$/);
    if (!match) return null;
    return verifySessionToken(match[1]!, deps.sessionSecret);
  }

  // Resolves the signed-in user, or sends 401 and returns null.
  async function requireUser(
    authorization: string | undefined,
    reply: { code: (status: number) => { send: (body: unknown) => unknown } },
  ): Promise<UserRecord | null> {
    const userId = await userIdFromHeader(authorization);
    const user = userId ? await deps.users.findById(userId) : null;
    if (!user) {
      reply.code(401).send({ error: 'unauthorized' });
      return null;
    }
    return user;
  }

  registerGrievanceRoutes(app, {
    grievances: deps.grievances,
    requests: deps.requests,
    requireUser,
    supportEmail: deps.supportEmail ?? 'krishnam@meraceo.com',
  });

  // Returns the signed-in person's private account fields. Public profile/list routes use
  // explicit allowlists and never include this email.
  // profileComplete and consentDone come from the server, so they survive a reinstall.
  async function publicUser(user: UserRecord) {
    const profile = await deps.profiles.findByUserId(user.id);
    const consents = await deps.consents.listForUser(user.id);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      // Legacy records created before these fields existed read as null, never as missing.
      role: user.role ?? null,
      ageConfirmed: user.ageConfirmed ?? null,
      dateOfBirthSet: Boolean(user.dateOfBirth),
      profileComplete: profile !== null,
      // Review status of a professional's profile (null when there is no profile or the user is an owner).
      moderation: profile && profile.role === 'professional' ? profile.moderation : null,
      // A short-lived link to the person's own photo or logo (null when none).
      photoUrl: profile?.photoKey ? await deps.storage.readUrl(profile.photoKey) : null,
      consentDone: consents.some((c) => c.consentType === 'terms' && c.granted),
    };
  }

  // Professionals owners may see: approved, available, and not opted out of match suggestions.
  // Checks the professional's latest matching consent choice.
  async function matchSuggestionsEnabled(userId: string) {
    return latestChoices(await deps.consents.listForUser(userId)).matching !== false;
  }

  async function matchablePool() {
    const pool = [];
    for (const profile of await deps.profiles.listMatchable()) {
      if (await matchSuggestionsEnabled(profile.userId)) pool.push(profile);
    }
    return pool;
  }

  app.get('/health', async () => ({ ok: true }));

  app.post('/auth/google', async (req, reply) => {
    const body = googleBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    try {
      const identity = await deps.verifyGoogle(body.data.idToken);
      const user = await deps.users.upsertFromGoogle(identity);
      const sessionToken = await issueSessionToken(user.id, deps.sessionSecret);
      return { sessionToken, user: await publicUser(user) };
    } catch (err) {
      if (err instanceof AuthError) return reply.code(401).send({ error: err.reason });
      throw err;
    }
  });

  // Password login is available only for an email verified through Google. Return the same
  // response for unknown accounts and bad passwords; throttle repeated guesses per source IP.
  const passwordLoginAttempts = new Map<string, ThrottleBucket>();
  const passwordSetupAttempts = new Map<string, ThrottleBucket>();
  app.post('/auth/password', async (req, reply) => {
    if (!consumePasswordAttempt(passwordLoginAttempts, req.ip, Date.now())) return reply.code(429).send({ error: 'invalid_credentials' });
    const body = passwordLoginBody.safeParse(req.body);
    if (!body.success) return reply.code(401).send({ error: 'invalid_credentials' });
    const identifier = body.data.identifier.trim().toLowerCase();
    const user = identifier.includes('@') ? await deps.users.findByVerifiedEmail(identifier) : null;
    const boundHash = user?.emailVerified === true && user.passwordEmail === user.email ? user.passwordHash : undefined;
    const valid = await verifyPassword(body.data.password, boundHash);
    if (!user || !valid) return reply.code(401).send({ error: 'invalid_credentials' });
    const sessionToken = await issueSessionToken(user.id, deps.sessionSecret);
    return { sessionToken, user: await publicUser(user) };
  });

  // Provision or replace a password only on a verified Google-backed account session.
  app.put('/me/password', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (!consumePasswordAttempt(passwordSetupAttempts, user.id, Date.now())) return reply.code(429).send({ error: 'too_many_attempts' });
    const body = passwordSetupBody.safeParse(req.body);
    if (!body.success || !validPassword(body.data.password)) return reply.code(400).send({ error: 'invalid_password' });
    if (!user.email || user.emailVerified !== true) return reply.code(403).send({ error: 'verified_email_required' });
    const passwordHash = await hashPassword(body.data.password);
    const saved = await deps.users.setPassword(user.id, user.email, passwordHash);
    if (!saved) return reply.code(403).send({ error: 'verified_email_required' });
    return { saved: true };
  });

  app.get('/me', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    return await publicUser(user);
  });

  // W2-08: stores the supplied birth date and derives whether the user is at least 18.
  app.post('/me/age', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    const body = ageBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const now = new Date();
    const updated = await deps.users.setDateOfBirth(user.id, body.data.dateOfBirth, isAtLeast18(body.data.dateOfBirth, now), now);
    return await publicUser(updated ?? user);
  });

  // W2-04: role is saved once. A second attempt returns 409 and the role never changes from the client.
  app.post('/me/role', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    const body = roleBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    if (user.ageConfirmed !== true) return reply.code(403).send({ error: 'age_not_confirmed' });
    try {
      const updated = await deps.users.setRoleOnce(user.id, body.data.role);
      return await publicUser(updated ?? user);
    } catch (err) {
      if (err instanceof RoleAlreadySetError) return reply.code(409).send({ error: 'role_already_set' });
      throw err;
    }
  });

  // W3-04: each choice is stored as its own event. Terms must be accepted.
  app.post('/me/consents', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    const body = consentBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    if (user.ageConfirmed !== true) return reply.code(403).send({ error: 'age_not_confirmed' });
    // Terms must be accepted, either in this request or earlier. They cannot be withdrawn here:
    // leaving the service is done by deleting the account.
    const termsNow = body.data.consents.find((c) => c.type === 'terms')?.granted;
    const termsBefore = latestChoices(await deps.consents.listForUser(user.id)).terms;
    if ((termsNow ?? termsBefore) !== true) return reply.code(400).send({ error: 'terms_required' });
    await deps.consents.record(
      body.data.consents.map((c) => ({
        userId: user.id,
        consentType: c.type,
        granted: c.granted,
        noticeVersion: NOTICE_VERSION,
        ...(body.data.idempotencyKey ? { idempotencyKey: body.data.idempotencyKey } : {}),
      })),
    );
    if (user.role === 'professional' && body.data.consents.some((c) => c.type === 'matching' && !c.granted)) {
      // A professional who opts out is removed from owners' saved lists as well as discovery.
      await deps.saved.deleteForProfessional(user.id);
    }
    return { recorded: body.data.consents.length, noticeVersion: NOTICE_VERSION };
  });

  // The person's current choice for each consent type (null = never answered).
  app.get('/me/consents', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    return { choices: latestChoices(await deps.consents.listForUser(user.id)), noticeVersion: NOTICE_VERSION };
  });

  // Privacy: everything we hold about the signed-in person, as one JSON file they can keep.
  app.get('/me/export', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    const [profile, needs, requests, consents, savedProfessionals] = await Promise.all([
      deps.profiles.findByUserId(user.id),
      user.role === 'owner' ? deps.needs.listByOwner(user.id) : Promise.resolve([]),
      user.role === 'owner' ? deps.requests.listByOwner(user.id) : deps.requests.listByProfessional(user.id),
      deps.consents.listForUser(user.id),
      user.role === 'owner' ? deps.saved.listForOwner(user.id) : Promise.resolve([]),
    ]);
    return {
      exportedAt: new Date().toISOString(),
      account: { id: user.id, name: user.name, email: user.email, role: user.role, dateOfBirth: user.dateOfBirth ?? null, createdAt: user.createdAt },
      profile: profile ? { data: profile.data, review: profile.moderation, available: profile.available } : null,
      needs,
      requests,
      consents,
      savedProfessionals,
    };
  });

  // Privacy: delete the account and everything linked to it. The consent history is kept without any
  // link to a person, because it is an append-only record of what was agreed (plan W3-04).
  app.delete('/me', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    await deps.requests.deleteForUser(user.id);
    await deps.messages.deleteForUser(user.id);
    await deps.calls?.deleteForUser(user.id);
    await deps.notifications.deleteForUser(user.id);
    await deps.saved.deleteForOwner(user.id);
    await deps.saved.deleteForProfessional(user.id);
    await deps.needs.deleteByOwner(user.id);
    await deps.profiles.deleteByUserId(user.id);
    // Remove every uploaded file (photo, logo, credentials) before the records that point to them.
    await deps.storage.removePrefix(`${user.id}/`);
    await deps.users.deleteById(user.id);
    return reply.code(204).send();
  });

  // W3-05: save the onboarding answers. The form is checked again here with the same shared
  // schema the app uses, picked by the person's role. Saving again replaces the earlier answers.
  app.put('/me/profile', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (user.ageConfirmed !== true) return reply.code(403).send({ error: 'age_not_confirmed' });
    if (!user.role) return reply.code(403).send({ error: 'role_not_set' });
    const existingProfile = await deps.profiles.findByUserId(user.id);
    const schema = user.role === 'owner'
      ? existingProfile ? ownerOnboardingSchema : ownerRegistrationSchema
      : existingProfile ? professionalOnboardingSchema : professionalRegistrationSchema;
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_profile' });
    await deps.profiles.save(user.id, user.role, body.data);
    // An owner's first need comes from onboarding. It is only created when they have none yet,
    // so saving the profile again never adds a duplicate.
    if (user.role === 'owner' && (await deps.needs.listByOwner(user.id)).length === 0) {
      const answers = ownerOnboardingSchema.parse(body.data);
      try {
        await deps.needs.create(user.id, {
          title: answers.needTitle,
          challenge: answers.challenge,
          timeline: answers.needTimeline,
          goals: answers.goals,
          expertise: answers.needExpertise,
          industry: answers.industry,
          budgetBand: answers.budgetBand,
          format: answers.preferredFormat,
        });
      } catch (error) {
        // A concurrent onboarding retry may have created the initial need after the count check.
        if (!(error instanceof DuplicateNeedError)) throw error;
      }
    }
    return await publicUser(user);
  });

  // Returns the saved onboarding answers so the app can show or edit them later.
  app.get('/me/profile', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    const profile = await deps.profiles.findByUserId(user.id);
    if (!profile) return reply.code(404).send({ error: 'no_profile' });
    return { role: profile.role, data: profile.data, updatedAt: profile.updatedAt };
  });

  // Testing shortcut: a professional can approve only their own profile.
  app.post('/me/profile/approve', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (user.role !== 'professional') return reply.code(403).send({ error: 'professionals_only' });
    const approved = await deps.profiles.approve(user.id);
    if (!approved) return reply.code(404).send({ error: 'no_profile' });
    return await publicUser(user);
  });

  // Discover (owner): every approved professional who can be asked, searchable and filterable, ranked by
  // how well they fit the chosen need. People who do not fit still appear, below those who do.
  app.get('/me/professionals', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (user.role !== 'owner') return reply.code(403).send({ error: 'owners_only' });
    const query = searchQuery.safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: 'invalid_query' });
    const { q, expertise, industry, fee, format, needId, saved: onlySaved, availability } = query.data;
    const savedIds = new Set(await deps.saved.listForOwner(user.id));

    const openNeeds = (await deps.needs.listByOwner(user.id)).filter((n) => n.status === 'open');
    const targets = needId ? openNeeds.filter((n) => n.id === needId) : openNeeds;
    const ownerProfile = await deps.profiles.findByUserId(user.id);
    const ownerData = ownerProfile?.role === 'owner' ? ownerProfile.data as Partial<OwnerOnboarding> : undefined;
    const businessProfile = ownerData ? { teamSize: ownerData.teamSize, revenue: ownerData.revenue } : undefined;
    const sent = new Map((await deps.requests.listByOwner(user.id)).map((r) => [`${r.needId}:${r.professionalId}`, r.status]));

    const results = [];
    for (const profile of await matchablePool()) {
      const pro = profile.data as unknown as ProfessionalOnboarding;
      if (q && !matchesText(`${professionalPublicName(pro)} ${pro.headline} ${pro.experience} ${pro.city} ${pro.state ?? ''}`, q)) continue;
      if (expertise && !pro.expertise.includes(expertise)) continue;
      if (industry && pro.industry !== industry && !pro.industriesAdvised?.includes(industry)) continue;
      if (fee && FEE_BANDS.indexOf(pro.feeBand) > FEE_BANDS.indexOf(fee)) continue;
      if (format && !pro.formats.includes(format)) continue;
      if (availability === 'configured' && !hasConfiguredAvailability(pro)) continue;
      if (onlySaved && !savedIds.has(profile.userId)) continue;

      // Best fit across the chosen needs.
      let best = { score: 0, reasons: [] as string[], matchedExpertise: [] as string[], needId: null as string | null };
      for (const need of targets) {
        const result = matchProfessional(pro, { expertise: need.expertise, industry: need.industry, budgetBand: need.budgetBand, format: need.format, businessProfile });
        if (result.score > best.score) best = { ...result, needId: need.id };
      }
      results.push({
        id: profile.userId,
        name: professionalPublicName(pro),
        headline: pro.headline,
        country: pro.country,
        state: pro.state,
        city: pro.city,
        expertise: pro.expertise,
        industry: pro.industry,
        feeBand: pro.feeBand,
        formats: pro.formats,
        photoUrl: profile.photoKey ? await deps.storage.readUrl(profile.photoKey) : null,
        requestStatus: best.needId ? (sent.get(`${best.needId}:${profile.userId}`) ?? null) : null,
        saved: savedIds.has(profile.userId),
        ...best,
      });
    }
    // Best fit first, then alphabetical so the list does not jump around.
    results.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id, 'en'));
    return { professionals: results.slice(0, 50) };
  });

  // One professional's full public profile, opened from a match card (owners only). Only approved professionals
  // who allow match suggestions can be opened. Phone, LinkedIn and email are never included.
  // `needs` lists the owner's open needs with the status of any request already sent to this person.
  app.get('/me/professionals/:id', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (user.role !== 'owner') return reply.code(403).send({ error: 'owners_only' });
    const { id } = req.params as { id: string };
    const profile = await deps.profiles.findByUserId(id);
    if (!profile || profile.role !== 'professional' || profile.moderation !== 'approved') return reply.code(404).send({ error: 'professional_not_found' });
    if (!(await matchSuggestionsEnabled(id))) return reply.code(404).send({ error: 'professional_not_found' });
    const pro = profile.data as unknown as ProfessionalOnboarding;
    const sent = new Map((await deps.requests.listByOwner(user.id)).filter((r) => r.professionalId === id).map((r) => [r.needId, r.status]));
    const needs = (await deps.needs.listByOwner(user.id)).filter((n) => n.status === 'open').map((n) => ({ id: n.id, title: n.title, requestStatus: sent.get(n.id) ?? null }));
    const isSaved = (await deps.saved.listForOwner(user.id)).includes(id);
    return {
      saved: isSaved,
      professional: {
        id,
        name: professionalPublicName(pro),
        headline: pro.headline,
        country: pro.country,
        state: pro.state,
        city: pro.city,
        designation: pro.designation ?? '',
        company: pro.company ?? '',
        yearsExperience: pro.yearsExperience ?? null,
        employmentType: pro.employmentType ?? null,
        qualification: pro.qualification,
        industry: pro.industry,
        industriesAdvised: pro.industriesAdvised ?? [],
        experience: pro.experience ?? '',
        workHistory: pro.workHistory,
        skills: pro.skills ?? [],
        expertise: pro.expertise ?? [],
        feeBand: pro.feeBand,
        formats: pro.formats ?? [],
        durationMinutes: pro.durationMinutes ?? null,
        engagementType: pro.engagementType ?? null,
        days: pro.days ?? [],
        availabilityWindows: pro.availabilityWindows ?? [],
        employmentHistory: (pro.employmentHistory ?? []).map(({ id, title, organization, startDate, endDate, current }) => ({ id, title, organization, startDate, ...(endDate ? { endDate } : {}), current })),
        educationHistory: (pro.educationHistory ?? []).map(({ id, qualification, institution, fieldOfStudy, completionYear }) => ({ id, qualification, institution, ...(fieldOfStudy ? { fieldOfStudy } : {}), ...(completionYear ? { completionYear } : {}) })),
        certifications: (pro.certifications ?? []).map(({ id, name, issuer, issueYear }) => ({ id, name, issuer, ...(issueYear ? { issueYear } : {}) })),
        timezone: pro.timezone ?? null,
        photoUrl: profile.photoKey ? await deps.storage.readUrl(profile.photoKey) : null,
      },
      needs,
    };
  });

  // Save a professional to come back to later (owners only, approved and discoverable professionals only).
  app.put('/me/saved/:id', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (user.role !== 'owner') return reply.code(403).send({ error: 'owners_only' });
    const { id } = req.params as { id: string };
    const profile = await deps.profiles.findByUserId(id);
    if (!profile || profile.role !== 'professional' || profile.moderation !== 'approved') return reply.code(404).send({ error: 'professional_not_found' });
    if (!(await matchSuggestionsEnabled(id))) return reply.code(404).send({ error: 'professional_not_found' });
    await deps.saved.add(user.id, id);
    return reply.code(204).send();
  });

  // Remove a saved professional. Removing someone who is not saved is fine.
  app.delete('/me/saved/:id', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (user.role !== 'owner') return reply.code(403).send({ error: 'owners_only' });
    await deps.saved.remove(user.id, (req.params as { id: string }).id);
    return reply.code(204).send();
  });

  // The professional's opportunity feed: open needs that fit their expertise, best fit first.
  // Owners are shown by business name and place only (never email or contact details).
  app.get('/me/opportunities', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (user.role !== 'professional') return reply.code(403).send({ error: 'professionals_only' });
    const profile = await deps.profiles.findByUserId(user.id);
    if (!profile) return { opportunities: [] };
    const pro = profile.data as unknown as ProfessionalOnboarding;
    const query = searchQuery.safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: 'invalid_query' });
    const { q, expertise, industry } = query.data;
    const scored = [];
    for (const need of await deps.needs.listOpen()) {
      if (expertise && !need.expertise.includes(expertise)) continue;
      if (industry && need.industry !== industry) continue;
      const ownerProfile = await deps.profiles.findByUserId(need.ownerId);
      const owner = ownerProfile?.data as unknown as OwnerOnboarding | undefined;
      const result = matchProfessional(pro, {
        expertise: need.expertise,
        industry: need.industry,
        budgetBand: need.budgetBand,
        format: need.format,
        businessProfile: owner ? { teamSize: owner.teamSize, revenue: owner.revenue } : undefined,
      });
      if (result.score === 0) continue;
      if (q && !matchesText(`${need.title} ${need.challenge} ${owner?.businessName ?? ''}`, q)) continue;
      scored.push({
        id: need.id,
        title: need.title,
        challenge: need.challenge,
        expertise: need.expertise,
        industry: need.industry,
        budgetBand: need.budgetBand,
        format: need.format ?? null,
        business: {
          name: owner?.businessName ?? '',
          city: owner?.city ?? '',
          state: owner?.state ?? null,
          country: owner?.country ?? '',
          photoUrl: ownerProfile?.photoKey ? await deps.storage.readUrl(ownerProfile.photoKey) : null,
        },
        ...result,
      });
    }
    return { opportunities: rankMatches(scored) };
  });

  // P8: open one opportunity only when this professional is eligible for its matching feed.
  // Business details are explicitly allowlisted; owner contact and private profile fields stay hidden.
  app.get('/me/opportunities/:needId', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (user.role !== 'professional') return reply.code(403).send({ error: 'professionals_only' });
    const { needId } = req.params as { needId: string };
    const need = await deps.needs.findById(needId);
    if (!need || need.status !== 'open') return reply.code(404).send({ error: 'opportunity_not_found' });

    const professionalProfile = await deps.profiles.findByUserId(user.id);
    if (!professionalProfile || professionalProfile.role !== 'professional') return reply.code(404).send({ error: 'opportunity_not_found' });
    const professional = professionalProfile.data as unknown as ProfessionalOnboarding;
    const ownerProfile = await deps.profiles.findByUserId(need.ownerId);
    if (!ownerProfile || ownerProfile.role !== 'owner') return reply.code(404).send({ error: 'opportunity_not_found' });
    const owner = ownerProfile.data as unknown as OwnerOnboarding;
    const result = matchProfessional(professional, {
      expertise: need.expertise,
      industry: need.industry,
      budgetBand: need.budgetBand,
      format: need.format,
      businessProfile: { teamSize: owner.teamSize, revenue: owner.revenue },
    });
    if (result.score === 0) return reply.code(404).send({ error: 'opportunity_not_found' });

    return {
      opportunity: {
        id: need.id,
        title: need.title,
        challenge: need.challenge,
        timeline: need.timeline ?? null,
        goals: need.goals ?? null,
        expertise: need.expertise,
        industry: need.industry,
        budgetBand: need.budgetBand ?? null,
        format: need.format ?? null,
        business: {
          name: owner.businessName,
          city: owner.city,
          state: owner.state ?? null,
          country: owner.country,
          photoUrl: ownerProfile.photoKey ? await deps.storage.readUrl(ownerProfile.photoKey) : null,
          industry: owner.industry,
          businessType: owner.businessType ?? null,
          sector: owner.sector ?? null,
          description: owner.description,
          teamSize: owner.teamSize ?? null,
          revenue: owner.revenue ?? null,
        },
        ...result,
      },
    };
  });

  // W5: an owner posts another need.
  app.post('/me/needs', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (user.role !== 'owner') return reply.code(403).send({ error: 'owners_only' });
    const body = createNeedSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_need' });
    try {
      return reply.code(201).send(publicNeed(await deps.needs.create(user.id, body.data)));
    } catch (error) {
      if (error instanceof DuplicateNeedError) return reply.code(409).send({ error: 'duplicate_need' });
      throw error;
    }
  });

  // The owner's own needs, newest first.
  app.get('/me/needs', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (user.role !== 'owner') return reply.code(403).send({ error: 'owners_only' });
    return { needs: (await deps.needs.listByOwner(user.id)).map(publicNeed) };
  });

  // Get one need for the owner who created it. Someone else's need looks missing.
  app.get('/me/needs/:needId', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (user.role !== 'owner') return reply.code(403).send({ error: 'owners_only' });
    const { needId } = req.params as { needId: string };
    const need = await deps.needs.findById(needId);
    if (!need || need.ownerId !== user.id) return reply.code(404).send({ error: 'need_not_found' });
    return publicNeed(need);
  });

  // Edit only an open need owned by this business. Invalid content does not reach the repository.
  app.put('/me/needs/:needId', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (user.role !== 'owner') return reply.code(403).send({ error: 'owners_only' });
    const { needId } = req.params as { needId: string };
    const body = createNeedSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_need' });
    let need;
    try {
      need = await deps.needs.update(user.id, needId, body.data);
    } catch (error) {
      if (error instanceof DuplicateNeedError) return reply.code(409).send({ error: 'duplicate_need' });
      throw error;
    }
    if (!need) return reply.code(404).send({ error: 'need_not_found_or_closed' });
    return publicNeed(need);
  });

  // Close one owner-scoped need. Closing twice is safe and returns the already closed need.
  app.post('/me/needs/:needId/close', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (user.role !== 'owner') return reply.code(403).send({ error: 'owners_only' });
    const { needId } = req.params as { needId: string };
    const need = await deps.needs.close(user.id, needId);
    if (!need) return reply.code(404).send({ error: 'need_not_found' });
    return publicNeed(need);
  });

  // W5-01: professionals ranked for one of the owner's needs. Only approved, available professionals
  // are considered, and only public profile fields are returned (never email or other contact details).
  app.get('/me/needs/:needId/matches', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (user.role !== 'owner') return reply.code(403).send({ error: 'owners_only' });
    const { needId } = req.params as { needId: string };
    const need = await deps.needs.findById(needId);
    // Someone else's need looks the same as a missing one.
    if (!need || need.ownerId !== user.id) return reply.code(404).send({ error: 'need_not_found' });

    // Requests the owner already sent for this need, so the app can show their status instead of a Send button.
    const sent = new Map((await deps.requests.listByOwner(user.id)).filter((r) => r.needId === need.id).map((r) => [r.professionalId, r.status]));
    const ownerProfile = await deps.profiles.findByUserId(user.id);
    const owner = ownerProfile?.role === 'owner' ? ownerProfile.data as Partial<OwnerOnboarding> : undefined;
    const scored = await Promise.all((await matchablePool()).map(async (profile) => {
      const pro = profile.data as unknown as ProfessionalOnboarding;
      const result = matchProfessional(pro, {
        expertise: need.expertise,
        industry: need.industry,
        budgetBand: need.budgetBand,
        format: need.format,
        businessProfile: owner ? { teamSize: owner.teamSize, revenue: owner.revenue } : undefined,
      });
      return {
        id: profile.userId,
        name: professionalPublicName(pro),
        headline: pro.headline,
        country: pro.country,
        state: pro.state,
        city: pro.city,
        expertise: pro.expertise,
        industry: pro.industry,
        feeBand: pro.feeBand,
        formats: pro.formats,
        photoUrl: profile.photoKey ? await deps.storage.readUrl(profile.photoKey) : null,
        requestStatus: sent.get(profile.userId) ?? null,
        ...result,
      };
    }));
    return { need: publicNeed(need), matches: rankMatches(scored) };
  });

  // Builds what each side sees of a request. Neither side ever gets the other's email or contact details.
  async function requestView(request: RequestRecord, viewer: 'owner' | 'professional') {
    const need = await deps.needs.findById(request.needId);
    const proProfile = await deps.profiles.findByUserId(request.professionalId);
    const pro = proProfile?.data as unknown as ProfessionalOnboarding | undefined;
    const consultation = {
      durationMinutes: request.durationMinutes ?? pro?.durationMinutes ?? null,
      timezone: pro?.timezone ?? null,
      availabilityWindows: pro?.availabilityWindows?.map(({ day, startTime, endTime }) => ({ day, startTime, endTime })) ?? [],
    };
    const base = { id: request.id, status: request.status, note: request.note ?? null, createdAt: request.createdAt, scheduledAt: request.scheduledAt ?? null, pendingSchedule: request.pendingSchedule ?? null, consultation };
    if (viewer === 'owner') {
      const photoUrl = proProfile?.photoKey ? await deps.storage.readUrl(proProfile.photoKey) : null;
      return { ...base, need: { id: request.needId, title: need?.title ?? '' }, professional: { id: request.professionalId, name: pro ? professionalPublicName(pro) : '', headline: pro?.headline ?? '', photoUrl } };
    }
    const ownerProfile = await deps.profiles.findByUserId(request.ownerId);
    const owner = ownerProfile?.data as unknown as OwnerOnboarding | undefined;
    const ownerPhotoUrl = ownerProfile?.photoKey ? await deps.storage.readUrl(ownerProfile.photoKey) : null;
    return {
      ...base,
      need: need ? { id: need.id, title: need.title, challenge: need.challenge, expertise: need.expertise, budgetBand: need.budgetBand, format: need.format ?? null } : null,
      owner: { name: owner?.ownerName ?? '', businessName: owner?.businessName ?? '', industry: owner?.industry ?? '', city: owner?.city ?? '', state: owner?.state ?? null, country: owner?.country ?? '', photoUrl: ownerPhotoUrl },
    };
  }

  // Name to show for a person in a notification, respecting a Professional's discreet mode.
  async function participantDisplayName(userId: string): Promise<string> {
    const profile = await deps.profiles.findByUserId(userId);
    if (profile?.role === 'professional') return professionalPublicName(profile.data as unknown as ProfessionalOnboarding);
    const data = profile?.data as { name?: string; ownerName?: string } | undefined;
    return data?.ownerName ?? data?.name ?? (await deps.users.findById(userId))?.name ?? '';
  }

  // Tell the other person on a request what just happened.
  async function notify(request: RequestRecord, to: string, actor: string, type: NotificationType) {
    const need = await deps.needs.findById(request.needId);
    await deps.notifications.create({ userId: to, type, requestId: request.id, actorName: await participantDisplayName(actor), needTitle: need?.title ?? '' });
  }

  // The person's notifications, newest first, with how many are unread.
  app.get('/me/notifications', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    return { notifications: await deps.notifications.listForUser(user.id), unread: await deps.notifications.countUnread(user.id) };
  });

  // Just the unread count, cheap enough for the app to ask often (it drives the badge on the tab bar).
  app.get('/me/notifications/unread', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    return { unread: await deps.notifications.countUnread(user.id) };
  });

  // Mark everything as read (the person has opened the list).
  app.post('/me/notifications/read', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    await deps.notifications.markAllRead(user.id);
    return { unread: 0 };
  });

  // W6: an owner sends a request to a matched professional about one of their open needs.
  app.post('/me/requests', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (user.role !== 'owner') return reply.code(403).send({ error: 'owners_only' });
    const body = createRequestSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const need = await deps.needs.findById(body.data.needId);
    if (!need || need.ownerId !== user.id || need.status !== 'open') return reply.code(404).send({ error: 'need_not_found' });
    // Only professionals who are approved and available can be asked.
    const pool = await matchablePool();
    if (!pool.some((p) => p.userId === body.data.professionalId)) return reply.code(404).send({ error: 'professional_not_found' });
    if (await deps.requests.findActive(need.id, body.data.professionalId)) return reply.code(409).send({ error: 'request_exists' });
    let created;
    try { created = await deps.requests.create({ needId: need.id, ownerId: user.id, professionalId: body.data.professionalId, note: body.data.note }); }
    catch (error) { if (error instanceof ActiveRequestExistsError) return reply.code(409).send({ error: 'request_exists' }); throw error; }
    await notify(created, created.professionalId, user.id, 'request_received');
    return reply.code(201).send(await requestView(created, 'owner'));
  });

  // The signed-in person's requests: owners see what they sent, professionals see what they received.
  app.get('/me/requests', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (!user.role) return reply.code(403).send({ error: 'role_not_set' });
    const list = user.role === 'owner' ? await deps.requests.listByOwner(user.id) : await deps.requests.listByProfessional(user.id);
    return { requests: await Promise.all(list.map((r) => requestView(r, user.role!))) };
  });

  // Conversations are available to both roles only after their consultation request is accepted.
  app.get('/me/conversations', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (!user.role) return reply.code(403).send({ error: 'role_not_set' });
    const all = user.role === 'owner' ? await deps.requests.listByOwner(user.id) : await deps.requests.listByProfessional(user.id);
    const eligible = all.filter((item) => item.status === 'accepted' || item.status === 'completed').slice(0, 50);
    const ids = eligible.map((item) => item.id);
    const [latest, unread] = await Promise.all([
      deps.messages.latestForRequests(ids),
      deps.messages.countUnread(ids, user.id),
    ]);
    return {
      conversations: await Promise.all(eligible.map(async (item) => {
        const message = latest.get(item.id);
        return {
          request: await requestView(item, user.role!),
          latestMessage: message ? { id: message.id, body: message.body, senderId: message.senderId, createdAt: message.createdAt, readAt: message.readAt } : null,
          unread: unread.get(item.id) ?? 0,
        };
      })),
    };
  });

  // Only the two request participants can open the thread; reading it syncs recipient read state.
  app.get('/me/requests/:requestId/messages', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    const { requestId } = req.params as { requestId: string };
    const request = await deps.requests.findById(requestId);
    const isOwner = request?.ownerId === user.id && user.role === 'owner';
    const isProfessional = request?.professionalId === user.id && user.role === 'professional';
    if (!request || (!isOwner && !isProfessional)) return reply.code(404).send({ error: 'conversation_not_found' });
    if (request.status !== 'accepted' && request.status !== 'completed') return reply.code(409).send({ error: 'conversation_not_open' });
    await deps.messages.markRead(request.id, user.id);
    const [messages, view] = await Promise.all([deps.messages.listForRequest(request.id), requestView(request, user.role!)]);
    return {
      request: view,
      messages: messages.map((message) => ({
        id: message.id,
        body: message.body,
        senderId: message.senderId,
        createdAt: message.createdAt,
        readAt: message.readAt,
      })),
    };
  });

  // Text messages stay private to the participants and are allowed on accepted/completed requests.
  app.post('/me/requests/:requestId/messages', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    const body = messageBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_message' });
    if (hasContactInformation(body.data.body)) return reply.code(400).send({ error: 'contact_info_not_allowed' });
    const { requestId } = req.params as { requestId: string };
    const request = await deps.requests.findById(requestId);
    const isOwner = request?.ownerId === user.id && user.role === 'owner';
    const isProfessional = request?.professionalId === user.id && user.role === 'professional';
    if (!request || (!isOwner && !isProfessional)) return reply.code(404).send({ error: 'conversation_not_found' });
    if (request.status !== 'accepted' && request.status !== 'completed') return reply.code(409).send({ error: 'conversation_not_open' });
    const recipientId = isOwner ? request.professionalId : request.ownerId;
    const message = await deps.messages.create({ requestId: request.id, senderId: user.id, recipientId, body: body.data.body });
    await notify(request, recipientId, user.id, 'message_received');
    return reply.code(201).send({
      id: message.id,
      body: message.body,
      senderId: message.senderId,
      createdAt: message.createdAt,
      readAt: message.readAt,
    });
  });

  // Only return invitations addressed to the authenticated user, from any conversation.
  app.get('/me/calls/incoming', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    const call = await deps.calls?.findIncoming(user.id);
    return { call: call ? { ...call, createdAt: call.createdAt.toISOString(), expiresAt: call.expiresAt.toISOString() } : null };
  });

  // Call invitations live on the accepted consultation, while Agora carries only the media stream.
  app.get('/me/requests/:requestId/calls/active', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    const { requestId } = req.params as { requestId: string };
    const request = await deps.requests.findById(requestId);
    const isParticipant = Boolean(request && user.role && (
      (request.ownerId === user.id && user.role === 'owner')
      || (request.professionalId === user.id && user.role === 'professional')
    ));
    if (!request || !isParticipant) return reply.code(404).send({ error: 'conversation_not_found' });
    if (request.status !== 'accepted' && request.status !== 'completed') return reply.code(409).send({ error: 'conversation_not_open' });
    if (!deps.calls) return reply.code(503).send({ error: 'video_calls_unavailable' });
    const call = await deps.calls.findActiveForRequest(request.id);
    return { call: call ? { ...call, createdAt: call.createdAt.toISOString(), expiresAt: call.expiresAt.toISOString() } : null };
  });

  app.post('/me/requests/:requestId/calls', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (!user.role) return reply.code(403).send({ error: 'role_not_set' });
    const { requestId } = req.params as { requestId: string };
    const request = await deps.requests.findById(requestId);
    const isOwner = request?.ownerId === user.id && user.role === 'owner';
    const isProfessional = request?.professionalId === user.id && user.role === 'professional';
    if (!request || (!isOwner && !isProfessional)) return reply.code(404).send({ error: 'conversation_not_found' });
    if (request.status !== 'accepted' && request.status !== 'completed') return reply.code(409).send({ error: 'conversation_not_open' });
    if (!deps.calls || !deps.agora) return reply.code(503).send({ error: 'video_calls_unavailable' });
    await deps.calls.expireStaleForRequest(request.id);
    if (await deps.calls.findActiveForRequest(request.id)) return reply.code(409).send({ error: 'call_in_progress' });
    let call: CallRecord;
    try {
      call = await deps.calls.create({
        requestId: request.id,
        callerId: user.id,
        recipientId: isOwner ? request.professionalId : request.ownerId,
      });
    } catch (error) {
      // The unique active-key index closes the race between two simultaneous call starts.
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        return reply.code(409).send({ error: 'call_in_progress' });
      }
      throw error;
    }
    return reply.code(201).send({ call: { ...call, createdAt: call.createdAt.toISOString(), expiresAt: call.expiresAt.toISOString() } });
  });

  app.post('/me/requests/:requestId/calls/:callId/:action', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    const { requestId, callId, action } = req.params as { requestId: string; callId: string; action: string };
    if (!deps.calls) return reply.code(503).send({ error: 'video_calls_unavailable' });
    const [request, call] = await Promise.all([deps.requests.findById(requestId), deps.calls.findById(callId)]);
    const isOwner = request?.ownerId === user.id && user.role === 'owner';
    const isProfessional = request?.professionalId === user.id && user.role === 'professional';
    if (!request || (!isOwner && !isProfessional) || !call || call.requestId !== request.id) {
      return reply.code(404).send({ error: 'call_not_found' });
    }
    if (request.status !== 'accepted' && request.status !== 'completed') return reply.code(409).send({ error: 'conversation_not_open' });
    if ((call.status === 'ringing' || call.status === 'accepted') && call.expiresAt <= new Date()) {
      await deps.calls.transition(call.id, [call.status], 'missed', new Date());
      return reply.code(409).send({ error: 'call_expired' });
    }

    if (action === 'token') {
      if (!deps.agora) return reply.code(503).send({ error: 'video_calls_unavailable' });
      const isCaller = call.callerId === user.id;
      const canJoin = call.status === 'accepted' || (call.status === 'ringing' && isCaller);
      if (!canJoin || call.expiresAt <= new Date()) return reply.code(409).send({ error: 'call_not_joinable' });
      const uid = isCaller ? 1 : 2;
      const channelName = `call-${call.id}`;
      const token = agoraToken.RtcTokenBuilder.buildTokenWithUid(
        deps.agora.appId,
        deps.agora.appCertificate,
        channelName,
        uid,
        agoraToken.RtcRole.PUBLISHER,
        3_600,
        3_600,
      );
      return { appId: deps.agora.appId, channelName, token, uid };
    }

    let nextStatus: CallStatus;
    let allowedFrom: CallStatus[];
    let expiresAt: Date;
    if (action === 'accept' && call.recipientId === user.id) {
      nextStatus = 'accepted';
      allowedFrom = ['ringing'];
      expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    } else if (action === 'decline' && call.recipientId === user.id) {
      nextStatus = 'declined';
      allowedFrom = ['ringing'];
      expiresAt = new Date();
    } else if (action === 'end' && (call.callerId === user.id || call.recipientId === user.id)) {
      nextStatus = 'ended';
      allowedFrom = ['ringing', 'accepted'];
      expiresAt = new Date();
    } else {
      return reply.code(403).send({ error: 'call_action_not_allowed' });
    }
    const updated = await deps.calls.transition(call.id, allowedFrom, nextStatus, expiresAt);
    if (!updated) return reply.code(409).send({ error: 'call_state_changed' });
    return { call: { ...updated, createdAt: updated.createdAt.toISOString(), expiresAt: updated.expiresAt.toISOString() } };
  });

  // Accept, decline or cancel a request. The shared state machine decides what is allowed for this person.
  app.post('/me/requests/:requestId/action', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (!user.role) return reply.code(403).send({ error: 'role_not_set' });
    const body = actionBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_action' });
    const { requestId } = req.params as { requestId: string };
    const request = await deps.requests.findById(requestId);
    // Only the two people on the request may see it. Anyone else gets "not found".
    const isParty = request && (request.ownerId === user.id || request.professionalId === user.id);
    if (!request || !isParty) return reply.code(404).send({ error: 'request_not_found' });
    const result = transitionRequest(request.status, body.data.action, { actor: user.role, now: new Date(), startsAt: request.scheduledAt ?? new Date(8640000000000000) });
    if (!result.ok) {
      const status = result.code === REQUEST_ERROR_CODES.forbidden ? 403 : 409;
      return reply.code(status).send({ error: result.code });
    }
    const updated = await deps.requests.setStatus(request.id, result.status, undefined, request.status);
    if (!updated) return reply.code(409).send({ error: 'request_changed' });
    // The other person on the request hears about it.
    const other = user.id === request.ownerId ? request.professionalId : request.ownerId;
    const type: NotificationType =
      result.status === 'accepted' ? 'request_accepted' : result.status === 'declined' ? 'request_declined' : result.status === 'completed' ? 'consultation_completed' : 'request_cancelled';
    await notify(request, other, user.id, type);
    return await requestView(updated ?? request, user.role);
  });

  // Plan when the consultation starts. Either person on an accepted request can set or change the time,
  // and the other person is told. It must be in the future and within the next 90 days.
  app.post('/me/requests/:requestId/schedule', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (!user.role) return reply.code(403).send({ error: 'role_not_set' });
    const body = scheduleBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_time' });
    const { requestId } = req.params as { requestId: string };
    const request = await deps.requests.findById(requestId);
    const isParty = request && (request.ownerId === user.id || request.professionalId === user.id);
    if (!request || !isParty) return reply.code(404).send({ error: 'request_not_found' });
    if (request.status !== 'accepted') return reply.code(409).send({ error: 'not_accepted' });
    const startsAt = new Date(body.data.startsAt);
    const now = Date.now();
    if (startsAt.getTime() <= now || startsAt.getTime() > now + 90 * 24 * 3600 * 1000) return reply.code(400).send({ error: 'invalid_time' });
    const proProfile = await deps.profiles.findByUserId(request.professionalId);
    const professional = proProfile?.data as unknown as ProfessionalOnboarding | undefined;
    if (!professional?.timezone || !professional.durationMinutes || !professional.availabilityWindows?.length) {
      return reply.code(409).send({ error: 'availability_not_configured' });
    }
    if (!isWithinAvailability(startsAt, professional.timezone, professional.durationMinutes, professional.availabilityWindows)) {
      return reply.code(400).send({ error: 'outside_availability' });
    }
    if (body.data.proposalId) {
      const proposal = request.pendingSchedule;
      if (!proposal || proposal.id !== body.data.proposalId || proposal.proposedBy === user.role || proposal.startsAt.getTime() !== startsAt.getTime()) return reply.code(409).send({ error: 'invalid_schedule_confirmation' });
    } else if (request.scheduledAt && request.scheduledAt.getTime() !== startsAt.getTime()) {
      const proposal = { id: randomUUID(), startsAt, durationMinutes: professional.durationMinutes, proposedBy: user.role };
      const proposed = await deps.requests.proposeSchedule(request.id, proposal, request.scheduleRevision);
      if (!proposed) return reply.code(409).send({ error: 'schedule_changed' });
      await notify(request, user.id === request.ownerId ? request.professionalId : request.ownerId, user.id, 'consultation_scheduled');
      return await requestView(proposed, user.role);
    }
    let updated;
    try {
      updated = await deps.requests.setSchedule(request.id, startsAt, request.pendingSchedule?.durationMinutes ?? professional.durationMinutes, undefined, request.scheduleRevision);
    } catch (error) {
      if (error instanceof SlotConflictError) return reply.code(409).send({ error: 'slot_conflict' });
      if (error instanceof LegacyScheduleError) return reply.code(409).send({ error: 'legacy_schedule_requires_review' });
      throw error;
    }
    if (!updated) return reply.code(409).send({ error: 'schedule_changed' });
    await notify(request, user.id === request.ownerId ? request.professionalId : request.ownerId, user.id, 'consultation_scheduled');
    return await requestView(updated ?? request, user.role);
  });

  // Save the photo (professionals) or logo (owners) the app just uploaded. The file must be one this person
  // uploaded for their own role, so nobody can point their profile at someone else's file.
  app.put('/me/photo', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    const body = photoBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const folder = user.role === 'professional' ? 'photos' : user.role === 'owner' ? 'logos' : null;
    if (!folder || !new RegExp(`^${user.id}/${folder}/[A-Za-z0-9-]+\\.(jpg|png|webp)$`).test(body.data.key)) return reply.code(400).send({ error: 'invalid_file' });
    const kind = user.role === 'owner' ? 'logo' : 'photo';
    if (!validUploadedImage(body.data.key, kind, await deps.storage.inspect(body.data.key))) return reply.code(400).send({ error: 'invalid_file' });
    const profile = await deps.profiles.findByUserId(user.id);
    if (!profile) return reply.code(409).send({ error: 'no_profile' });
    await deps.profiles.setPhotoKey(user.id, body.data.key);
    if (profile.photoKey && profile.photoKey !== body.data.key) await deps.storage.remove(profile.photoKey);
    return await publicUser(user);
  });

  // Remove the photo or logo.
  app.delete('/me/photo', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    const profile = await deps.profiles.findByUserId(user.id);
    if (profile?.photoKey) {
      await deps.profiles.setPhotoKey(user.id, null);
      await deps.storage.remove(profile.photoKey);
    }
    return await publicUser(user);
  });

  app.post('/uploads/presign', async (req, reply) => {
    const userId = await userIdFromHeader(req.headers.authorization);
    if (!userId) return reply.code(401).send({ error: 'unauthorized' });
    const body = presignBody.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const result = await deps.storage.createUploadUrl({
      userId,
      kind: body.data.kind,
      contentType: body.data.contentType,
    });
    if (!result) return reply.code(400).send({ error: 'unsupported_file_type' });
    return result;
  });

  return app;
}

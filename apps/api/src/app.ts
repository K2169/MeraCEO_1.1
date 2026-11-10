import Fastify from 'fastify';
import {
  EXPERTISE_IDS,
  FEE_BANDS,
  FORMATS,
  INDUSTRY_IDS,
  createNeedSchema,
  createRequestSchema,
  transitionRequest,
  REQUEST_ERROR_CODES,
  type OwnerOnboarding,
  matchProfessional,
  ownerOnboardingSchema,
  professionalOnboardingSchema,
  rankMatches,
  type ProfessionalOnboarding,
} from '@meraceo/shared';
import { z } from 'zod';

import { AuthError, type GoogleVerifier } from './auth/google.js';
import { issueSessionToken, verifySessionToken } from './auth/session.js';
import { CONSENT_TYPES, type ConsentEvent, type ConsentRepository } from './consent/repository.js';
import type { NotificationRepository, NotificationType } from './notifications/repository.js';
import type { SavedRepository } from './saved/repository.js';
import type { NeedRepository } from './needs/repository.js';
import type { RequestRecord, RequestRepository } from './requests/repository.js';
import type { ProfileRepository } from './profiles/repository.js';
import { UPLOAD_KINDS } from './storage/presign.js';
import type { Storage } from './storage/storage.js';
import { RoleAlreadySetError, type UserRecord, type UserRepository } from './users/repository.js';

export interface AppDeps {
  sessionSecret: string;
  verifyGoogle: GoogleVerifier;
  users: UserRepository;
  consents: ConsentRepository;
  profiles: ProfileRepository;
  needs: NeedRepository;
  requests: RequestRepository;
  notifications: NotificationRepository;
  saved: SavedRepository;
  storage: Storage;
}

// Version of the privacy notice the app shows. Bump it when W3-06 approves new wording.
export const NOTICE_VERSION = 'draft-1';

const googleBody = z.object({ idToken: z.string().min(20).max(4096) });
const presignBody = z.object({
  kind: z.enum(Object.keys(UPLOAD_KINDS) as [keyof typeof UPLOAD_KINDS, ...(keyof typeof UPLOAD_KINDS)[]]),
  contentType: z.string().max(100),
});
const actionBody = z.object({ action: z.enum(['accept', 'decline', 'cancel', 'complete']) });
const scheduleBody = z.object({ startsAt: z.string().datetime() });
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
});
// True when every word typed appears somewhere in the text (case does not matter).
const matchesText = (text: string, query: string) => query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => text.toLowerCase().includes(word));

const photoBody = z.object({ key: z.string().min(10).max(200) });
const roleBody = z.object({ role: z.enum(['owner', 'professional']) });
const ageBody = z.object({ dateOfBirth: z.string().refine(isValidDateOfBirth) });
const consentBody = z.object({
  consents: z
    .array(z.object({ type: z.enum(CONSENT_TYPES), granted: z.boolean() }))
    .min(1)
    .max(CONSENT_TYPES.length),
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
    logger: options.logger === false ? false : { redact: ['req.headers.authorization', 'req.body.idToken', 'req.body.dateOfBirth'] },
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

  // Picks the user fields that are safe to send to the app (never the email).
  // profileComplete and consentDone come from the server, so they survive a reinstall.
  async function publicUser(user: UserRecord) {
    const profile = await deps.profiles.findByUserId(user.id);
    const consents = await deps.consents.listForUser(user.id);
    return {
      id: user.id,
      name: user.name,
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
    const schema = user.role === 'owner' ? ownerOnboardingSchema : professionalOnboardingSchema;
    const body = schema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_profile' });
    await deps.profiles.save(user.id, user.role, body.data);
    // An owner's first need comes from onboarding. It is only created when they have none yet,
    // so saving the profile again never adds a duplicate.
    if (user.role === 'owner' && (await deps.needs.listByOwner(user.id)).length === 0) {
      const answers = ownerOnboardingSchema.parse(body.data);
      await deps.needs.create(user.id, {
        title: answers.needTitle,
        challenge: answers.challenge,
        goals: answers.goals,
        expertise: answers.needExpertise,
        industry: answers.industry,
        budgetBand: answers.budgetBand,
        format: answers.preferredFormat,
      });
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

  // Discover (owner): every approved professional who can be asked, searchable and filterable, ranked by
  // how well they fit the chosen need. People who do not fit still appear, below those who do.
  app.get('/me/professionals', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (user.role !== 'owner') return reply.code(403).send({ error: 'owners_only' });
    const query = searchQuery.safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: 'invalid_query' });
    const { q, expertise, industry, fee, format, needId, saved: onlySaved } = query.data;
    const savedIds = new Set(await deps.saved.listForOwner(user.id));

    const openNeeds = (await deps.needs.listByOwner(user.id)).filter((n) => n.status === 'open');
    const targets = needId ? openNeeds.filter((n) => n.id === needId) : openNeeds;
    const sent = new Map((await deps.requests.listByOwner(user.id)).map((r) => [`${r.needId}:${r.professionalId}`, r.status]));

    const results = [];
    for (const profile of await matchablePool()) {
      const pro = profile.data as unknown as ProfessionalOnboarding;
      if (q && !matchesText(`${pro.name} ${pro.headline} ${pro.experience} ${pro.city} ${pro.state ?? ''}`, q)) continue;
      if (expertise && !pro.expertise.includes(expertise)) continue;
      if (industry && pro.industry !== industry) continue;
      if (fee && FEE_BANDS.indexOf(pro.feeBand) > FEE_BANDS.indexOf(fee)) continue;
      if (format && !pro.formats.includes(format)) continue;
      if (onlySaved && !savedIds.has(profile.userId)) continue;

      // Best fit across the chosen needs.
      let best = { score: 0, reasons: [] as string[], matchedExpertise: [] as string[], needId: null as string | null };
      for (const need of targets) {
        const result = matchProfessional(pro, { expertise: need.expertise, industry: need.industry, budgetBand: need.budgetBand, format: need.format });
        if (result.score > best.score) best = { ...result, needId: need.id };
      }
      results.push({
        id: profile.userId,
        name: pro.name,
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
        name: pro.name,
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
        experience: pro.experience ?? '',
        workHistory: pro.workHistory,
        skills: pro.skills ?? [],
        expertise: pro.expertise ?? [],
        feeBand: pro.feeBand,
        formats: pro.formats ?? [],
        engagementType: pro.engagementType ?? null,
        days: pro.days ?? [],
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
      const result = matchProfessional(pro, { expertise: need.expertise, industry: need.industry, budgetBand: need.budgetBand, format: need.format });
      if (result.score === 0) continue;
      const ownerProfile = await deps.profiles.findByUserId(need.ownerId);
      const owner = ownerProfile?.data as unknown as OwnerOnboarding | undefined;
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

  // W5: an owner posts another need.
  app.post('/me/needs', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (user.role !== 'owner') return reply.code(403).send({ error: 'owners_only' });
    const body = createNeedSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_need' });
    return reply.code(201).send(await deps.needs.create(user.id, body.data));
  });

  // The owner's own needs, newest first.
  app.get('/me/needs', async (req, reply) => {
    const user = await requireUser(req.headers.authorization, reply);
    if (!user) return reply;
    if (user.role !== 'owner') return reply.code(403).send({ error: 'owners_only' });
    return { needs: await deps.needs.listByOwner(user.id) };
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
    const scored = await Promise.all((await matchablePool()).map(async (profile) => {
      const pro = profile.data as unknown as ProfessionalOnboarding;
      const result = matchProfessional(pro, {
        expertise: need.expertise,
        industry: need.industry,
        budgetBand: need.budgetBand,
        format: need.format,
      });
      return {
        id: profile.userId,
        name: pro.name,
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
    return { need, matches: rankMatches(scored) };
  });

  // Builds what each side sees of a request. Neither side ever gets the other's email or contact details.
  async function requestView(request: RequestRecord, viewer: 'owner' | 'professional') {
    const need = await deps.needs.findById(request.needId);
    const base = { id: request.id, status: request.status, note: request.note ?? null, createdAt: request.createdAt, scheduledAt: request.scheduledAt ?? null };
    if (viewer === 'owner') {
      const proProfile = await deps.profiles.findByUserId(request.professionalId);
      const pro = proProfile?.data as unknown as ProfessionalOnboarding | undefined;
      const photoUrl = proProfile?.photoKey ? await deps.storage.readUrl(proProfile.photoKey) : null;
      return { ...base, need: { id: request.needId, title: need?.title ?? '' }, professional: { id: request.professionalId, name: pro?.name ?? '', headline: pro?.headline ?? '', photoUrl } };
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

  // Name to show for a person in a notification: their name from the profile, else their account name.
  async function displayName(userId: string): Promise<string> {
    const profile = await deps.profiles.findByUserId(userId);
    const data = profile?.data as { name?: string; ownerName?: string } | undefined;
    return data?.ownerName ?? data?.name ?? (await deps.users.findById(userId))?.name ?? '';
  }

  // Tell the other person on a request what just happened.
  async function notify(request: RequestRecord, to: string, actor: string, type: NotificationType) {
    const need = await deps.needs.findById(request.needId);
    await deps.notifications.create({ userId: to, type, requestId: request.id, actorName: await displayName(actor), needTitle: need?.title ?? '' });
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
    const created = await deps.requests.create({ needId: need.id, ownerId: user.id, professionalId: body.data.professionalId, note: body.data.note });
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
    const updated = await deps.requests.setStatus(request.id, result.status);
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
    const updated = await deps.requests.setSchedule(request.id, startsAt);
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

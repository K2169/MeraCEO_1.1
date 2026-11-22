// Talks to apps/api only. The app never holds Mongo, B2 or Google server credentials.
import type { WeeklyAvailabilityWindow } from '@meraceo/shared';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://meraceo-api-staging.onrender.com';

export type Role = 'owner' | 'professional';

export interface Me {
  id: string;
  name: string | null;
  email: string | null; // private account email; only returned for the signed-in user
  role: Role | null;
  ageConfirmed: boolean | null;
  dateOfBirthSet: boolean;
  profileComplete: boolean; // onboarding answers are saved on the server
  consentDone: boolean; // the terms have been accepted
  moderation: 'pending_review' | 'approved' | 'hidden' | null; // review status of a professional's profile
  photoUrl: string | null; // short-lived link to the person's own photo or logo
}

// Error for a failed API call. Holds the HTTP status and the short error code.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

// Sends one request to the API and returns the JSON. Adds the session token when given.
async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options: { body?: unknown; token?: string; signal?: AbortSignal } = {},
): Promise<T> {
  // Only requests with a body say they are JSON. The server rejects an empty body marked as JSON.
  const headers: Record<string, string> = options.body === undefined ? {} : { 'content-type': 'application/json' };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    signal: options.signal,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, typeof json.error === 'string' ? json.error : 'request_failed');
  return json as T;
}

export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed';

// A business need an owner posted.
export interface Need {
  id: string;
  title: string;
  challenge: string;
  timeline?: string;
  goals?: string;
  expertise: string[];
  industry: string;
  budgetBand?: string;
  format?: string;
  status: 'open' | 'closed';
}

// What the owner types when posting a need.
export type NewNeed = Omit<Need, 'id' | 'status' | 'timeline'> & { timeline: string };

// One professional ranked for a need. Public profile fields only (no contact details).
export interface Match {
  id: string;
  name: string;
  headline: string;
  country: string;
  state?: string;
  city: string;
  expertise: string[];
  industry: string;
  feeBand: string;
  formats: string[];
  photoUrl?: string | null;
  requestStatus: RequestStatus | null; // set when the owner already sent a request for this need
  score: number;
  reasons: ('expertise' | 'industry' | 'budget' | 'format' | 'business_profile')[];
  matchedExpertise: string[];
  needId?: string | null; // the need this person fits best (search results only)
  saved?: boolean; // the owner has saved this person
}

// A professional's full public profile (opened from a match). No contact details.
export interface ProfessionalProfile {
  id: string;
  name: string;
  headline: string;
  country: string;
  state?: string;
  city: string;
  designation: string;
  company: string;
  yearsExperience: number | null;
  employmentType: string | null;
  qualification?: string;
  industry: string;
  industriesAdvised: string[];
  experience: string;
  workHistory?: string;
  skills: string[];
  expertise: string[];
  feeBand: string;
  formats: string[];
  durationMinutes: number | null;
  engagementType: string | null;
  days: string[];
  availabilityWindows: { day: string; startTime: string; endTime: string }[];
  timezone: string | null;
  employmentHistory: { id: string; title: string; organization: string; startDate: string; endDate?: string; current: boolean }[];
  educationHistory: { id: string; institution: string; qualification: string; fieldOfStudy?: string; completionYear?: number }[];
  certifications: { id: string; name: string; issuer: string; issueYear?: number }[];
  photoUrl: string | null;
}

// A consultation request as the signed-in person sees it. Owners get `professional`, professionals get `owner`.
export interface RequestItem {
  id: string;
  status: RequestStatus;
  note: string | null;
  createdAt: string;
  pendingSchedule?: { id: string; startsAt: string; durationMinutes: number; proposedBy: 'owner' | 'professional' } | null;
  scheduledAt: string | null; // planned start of the consultation, once someone has set it
  consultation?: {
    durationMinutes: number | null;
    timezone: string | null;
    availabilityWindows: WeeklyAvailabilityWindow[];
  };
  need: { id: string; title: string; challenge?: string; expertise?: string[]; budgetBand?: string; format?: string | null } | null;
  professional?: { id: string; name: string; headline: string; photoUrl: string | null };
  owner?: { name: string; businessName: string; industry: string; city: string; state: string | null; country: string; photoUrl: string | null };
}

// One open need as shown in a professional's opportunity feed.
export interface Opportunity {
  id: string;
  title: string;
  challenge: string;
  timeline?: string | null;
  expertise: string[];
  industry: string;
  budgetBand?: string | null;
  format: string | null;
  business: { name: string; city: string; state: string | null; country: string; photoUrl: string | null };
  score: number;
  reasons: ('expertise' | 'industry' | 'budget' | 'format' | 'business_profile')[];
  matchedExpertise: string[];
}

// An opportunity detail uses public business context only and never includes owner contact information.
export interface OpportunityDetail extends Opportunity {
  goals: string | null;
  business: Opportunity['business'] & {
    industry: string;
    businessType: string | null;
    sector: string | null;
    description: string;
    teamSize: string | null;
    revenue: string | null;
  };
}

// Search and filter choices sent to the server. Anything left out is not filtered.
export interface SearchParams {
  q?: string;
  expertise?: string | null;
  industry?: string | null;
  fee?: string | null;
  format?: string | null;
  needId?: string | null;
  saved?: 'true' | null; // only professionals the owner has saved
  availability?: 'configured' | null;
}

// Turns the choices into a query string, skipping empty ones.
function queryString(params: SearchParams): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

// One line in the notification list.
export interface AppNotification {
  id: string;
  type: 'request_received' | 'request_accepted' | 'request_declined' | 'request_cancelled' | 'consultation_scheduled' | 'consultation_completed' | 'message_received';
  actorName: string;
  needTitle: string;
  createdAt: string;
  readAt: string | null;
}

export interface ChatMessage {
  id: string;
  body: string;
  senderId: string;
  createdAt: string;
  readAt: string | null;
}

export interface Conversation {
  request: RequestItem;
  latestMessage: ChatMessage | null;
  unread: number;
}

export interface CallInvitation {
  id: string;
  requestId: string;
  callerId: string;
  recipientId: string;
  status: 'ringing' | 'accepted' | 'declined' | 'ended' | 'missed';
  createdAt: string;
  expiresAt: string;
}

export interface CallCredentials {
  appId: string;
  channelName: string;
  token: string;
  uid: number;
}

export type ConsentChoices = Record<'matching' | 'contact_sharing' | 'notifications' | 'terms', boolean | null>;
export type GrievanceCategory = 'technical' | 'account' | 'privacy' | 'consultation' | 'other';

export interface SignInResult {
  sessionToken: string;
  user: Me;
}

// Every API call the app makes, in one place (sign in, me, age, role, profile, consent).
export const api = {
  signInWithGoogleToken: (idToken: string) => request<SignInResult>('POST', '/auth/google', { body: { idToken } }),
  signInWithPassword: (identifier: string, password: string) => request<SignInResult>('POST', '/auth/password', { body: { identifier, password } }),
  setPassword: (token: string, password: string) => request<{ saved: boolean }>('PUT', '/me/password', { token, body: { password } }),
  getMe: (token: string, signal?: AbortSignal) => request<Me>('GET', '/me', { token, signal }),
  setAge: (token: string, dateOfBirth: string) => request<Me>('POST', '/me/age', { token, body: { dateOfBirth } }),
  setRole: (token: string, role: Role) => request<Me>('POST', '/me/role', { token, body: { role } }),
  saveProfile: (token: string, profile: unknown) => request<Me>('PUT', '/me/profile', { token, body: profile }),
  getNeeds: (token: string) => request<{ needs: Need[] }>('GET', '/me/needs', { token }),
  getNeed: (token: string, id: string) => request<Need>('GET', `/me/needs/${id}`, { token }),
  createNeed: (token: string, need: NewNeed) => request<Need>('POST', '/me/needs', { token, body: need }),
  updateNeed: (token: string, id: string, need: NewNeed) => request<Need>('PUT', `/me/needs/${id}`, { token, body: need }),
  closeNeed: (token: string, id: string) => request<Need>('POST', `/me/needs/${id}/close`, { token, body: {} }),
  getMatches: (token: string, needId: string) =>
    request<{ need: Need; matches: Match[] }>('GET', `/me/needs/${needId}/matches`, { token }),
  getProfile: (token: string) => request<{ role: Role; data: Record<string, unknown> }>('GET', '/me/profile', { token }),
  approveOwnProfessionalProfile: (token: string) => request<Me>('POST', '/me/profile/approve', { token, body: {} }),
  getProfessional: (token: string, id: string) =>
    request<{ saved: boolean; professional: ProfessionalProfile; needs: { id: string; title: string; requestStatus: RequestStatus | null }[] }>('GET', `/me/professionals/${id}`, { token }),
  saveProfessional: (token: string, id: string) => request<Record<string, never>>('PUT', `/me/saved/${id}`, { token }),
  unsaveProfessional: (token: string, id: string) => request<Record<string, never>>('DELETE', `/me/saved/${id}`, { token }),
  sendRequest: (token: string, input: { needId: string; professionalId: string; note?: string }) =>
    request<RequestItem>('POST', '/me/requests', { token, body: input }),
  getRequests: (token: string) => request<{ requests: RequestItem[] }>('GET', '/me/requests', { token }),
  getConversations: (token: string) => request<{ conversations: Conversation[] }>('GET', '/me/conversations', { token }),
  getMessages: (token: string, requestId: string) => request<{ request: RequestItem; messages: ChatMessage[] }>('GET', `/me/requests/${requestId}/messages`, { token }),
  sendMessage: (token: string, requestId: string, body: string) => request<ChatMessage>('POST', `/me/requests/${requestId}/messages`, { token, body: { body } }),
  getIncomingCall: (token: string) => request<{ call: CallInvitation | null }>('GET', '/me/calls/incoming', { token }),
  getActiveCall: (token: string, requestId: string) => request<{ call: CallInvitation | null }>('GET', `/me/requests/${requestId}/calls/active`, { token }),
  startCall: (token: string, requestId: string) => request<{ call: CallInvitation }>('POST', `/me/requests/${requestId}/calls`, { token, body: {} }),
  updateCall: (token: string, requestId: string, callId: string, action: 'accept' | 'decline' | 'end') =>
    request<{ call: CallInvitation }>('POST', `/me/requests/${requestId}/calls/${callId}/${action}`, { token, body: {} }),
  getCallCredentials: (token: string, requestId: string, callId: string) =>
    request<CallCredentials>('POST', `/me/requests/${requestId}/calls/${callId}/token`, { token, body: {} }),
  scheduleConsultation: (token: string, id: string, startsAt: string, proposalId?: string) =>
    request<RequestItem>('POST', `/me/requests/${id}/schedule`, { token, body: { startsAt, proposalId } }),
  actOnRequest: (token: string, id: string, action: 'accept' | 'decline' | 'cancel' | 'complete') =>
    request<RequestItem>('POST', `/me/requests/${id}/action`, { token, body: { action } }),
  getOpportunities: (token: string, params: SearchParams = {}) =>
    request<{ opportunities: Opportunity[] }>('GET', `/me/opportunities${queryString(params)}`, { token }),
  getOpportunity: (token: string, id: string) => request<{ opportunity: OpportunityDetail }>('GET', `/me/opportunities/${id}`, { token }),
  searchProfessionals: (token: string, params: SearchParams = {}) =>
    request<{ professionals: Match[] }>('GET', `/me/professionals${queryString(params)}`, { token }),
  getNotifications: (token: string) => request<{ notifications: AppNotification[]; unread: number }>('GET', '/me/notifications', { token }),
  getSupport: () => request<{ email: string | null }>('GET', '/support'),
  reportProblem: (token: string, input: { category: GrievanceCategory; message: string; requestId?: string; idempotencyKey: string }) =>
    request<{ id: string; status: 'received' }>('POST', '/me/grievances', { token, body: input }),
  getUnread: (token: string) => request<{ unread: number }>('GET', '/me/notifications/unread', { token }),
  markNotificationsRead: (token: string) => request<{ unread: number }>('POST', '/me/notifications/read', { token, body: {} }),
  presignUpload: (token: string, kind: 'photo' | 'logo', contentType: string) =>
    request<{ uploadUrl: string; key: string; expiresIn: number }>('POST', '/uploads/presign', { token, body: { kind, contentType } }),
  savePhoto: (token: string, key: string) => request<Me>('PUT', '/me/photo', { token, body: { key } }),
  removePhoto: (token: string) => request<Me>('DELETE', '/me/photo', { token }),
  getConsents: (token: string) => request<{ choices: ConsentChoices }>('GET', '/me/consents', { token }),
  exportData: (token: string) => request<Record<string, unknown>>('GET', '/me/export', { token }),
  deleteAccount: (token: string) => request<Record<string, never>>('DELETE', '/me', { token }),
  recordConsents: (token: string, consents: { type: string; granted: boolean }[], idempotencyKey?: string) =>
    request<{ recorded: number; noticeVersion: string }>('POST', '/me/consents', { token, body: { consents, ...(idempotencyKey ? { idempotencyKey } : {}) } }),
};

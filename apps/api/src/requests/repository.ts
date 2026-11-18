import { randomUUID } from 'node:crypto';

import type { RequestStatus } from '@meraceo/shared';
import type { Collection, Db } from 'mongodb';

// A consultation request from an owner to a professional about one of the owner's needs.
export interface RequestRecord {
  id: string;
  needId: string;
  ownerId: string;
  professionalId: string;
  note?: string;
  activeKey?: string;
  status: RequestStatus;
  // When the consultation is planned to start. Set after the request is accepted; completing needs it to have passed.
  scheduledAt?: Date;
  durationMinutes?: number;
  pendingSchedule?: { id: string; startsAt: Date; durationMinutes: number; proposedBy: 'owner' | 'professional' };
  occupiedSlots?: string[];
  scheduleRevision?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewRequest {
  needId: string;
  ownerId: string;
  professionalId: string;
  note?: string;
}

export interface RequestRepository {
  create(input: NewRequest, now?: Date): Promise<RequestRecord>;
  findById(id: string): Promise<RequestRecord | null>;
  // The open (pending or accepted) request for this need and professional, if any.
  findActive(needId: string, professionalId: string): Promise<RequestRecord | null>;
  listByOwner(ownerId: string): Promise<RequestRecord[]>;
  listByProfessional(professionalId: string): Promise<RequestRecord[]>;
  setStatus(id: string, status: RequestStatus, now?: Date, expectedStatus?: RequestStatus): Promise<RequestRecord | null>;
  setSchedule(id: string, scheduledAt: Date, durationMinutes: number, now?: Date, expectedRevision?: number): Promise<RequestRecord | null>;
  proposeSchedule(id: string, proposal: NonNullable<RequestRecord['pendingSchedule']>, revision?: number): Promise<RequestRecord | null>;
  // Removes every request this person sent or received (account deletion).
  deleteForUser(userId: string): Promise<void>;
}

export class ActiveRequestExistsError extends Error {}
export class SlotConflictError extends Error {}
export class LegacyScheduleError extends Error {}

// Reserve UTC minutes so unusual timezone offsets cannot hide partial overlaps.
export function occupiedMinutes(startsAt: Date, durationMinutes: number): string[] {
  if (![30, 60, 90].includes(durationMinutes) || !Number.isFinite(startsAt.getTime()) || startsAt.getTime() % 60000 !== 0) throw new Error('invalid_schedule');
  const first = startsAt.getTime() / 60000;
  return Array.from({ length: durationMinutes }, (_, index) => String(first + index));
}

const OPEN: RequestStatus[] = ['pending', 'accepted'];

// Stores requests in MongoDB. Lists are newest first.
export class MongoRequestRepository implements RequestRepository {
  private readonly requests: Collection<RequestRecord>;

  constructor(db: Db) {
    this.requests = db.collection<RequestRecord>('requests');
  }

  async ensureIndexes(): Promise<void> {
    await this.requests.createIndex({ id: 1 }, { unique: true });
    await this.requests.createIndex({ ownerId: 1, createdAt: -1 });
    await this.requests.createIndex({ professionalId: 1, createdAt: -1 });
    await this.requests.createIndex({ needId: 1, professionalId: 1 });
    await this.requests.createIndex({ activeKey: 1 }, { unique: true, partialFilterExpression: { activeKey: { $exists: true } } });
    await this.requests.createIndex({ professionalId: 1, occupiedSlots: 1 }, { unique: true, partialFilterExpression: { occupiedSlots: { $exists: true } } });
  }

  async create(input: NewRequest, now = new Date()): Promise<RequestRecord> {
    const record: RequestRecord = { ...input, activeKey: JSON.stringify([input.needId, input.professionalId]), id: randomUUID(), status: 'pending', createdAt: now, updatedAt: now };
    try { await this.requests.insertOne({ ...record }); }
    catch (error) { if ((error as { code?: number }).code === 11000) throw new ActiveRequestExistsError('request_exists'); throw error; }
    return record;
  }

  async findById(id: string): Promise<RequestRecord | null> {
    return this.requests.findOne({ id }, { projection: { _id: 0 } });
  }

  async findActive(needId: string, professionalId: string): Promise<RequestRecord | null> {
    return this.requests.findOne({ needId, professionalId, status: { $in: OPEN } }, { projection: { _id: 0 } });
  }

  async listByOwner(ownerId: string): Promise<RequestRecord[]> {
    return this.requests.find({ ownerId }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
  }

  async listByProfessional(professionalId: string): Promise<RequestRecord[]> {
    return this.requests.find({ professionalId }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
  }

  async setStatus(id: string, status: RequestStatus, now = new Date(), expectedStatus?: RequestStatus): Promise<RequestRecord | null> {
    return this.requests.findOneAndUpdate({ id, ...(expectedStatus ? { status: expectedStatus } : {}) }, { $set: { status, updatedAt: now }, ...(!OPEN.includes(status) ? { $unset: { occupiedSlots: '' as const, activeKey: '' as const, pendingSchedule: '' as const } } : {}) }, { returnDocument: 'after', projection: { _id: 0 } });
  }

  async setSchedule(id: string, scheduledAt: Date, durationMinutes: number, now = new Date(), expectedRevision?: number): Promise<RequestRecord | null> {
    const current = await this.findById(id);
    if (!current || current.status !== 'accepted' || (expectedRevision !== undefined && current.scheduleRevision !== expectedRevision)) return null;
    const legacy = await this.requests.countDocuments({ professionalId: current.professionalId, status: 'accepted', scheduledAt: { $exists: true }, occupiedSlots: { $exists: false } });
    if (legacy > 0) throw new LegacyScheduleError('legacy_schedule_requires_audit');
    const occupiedSlots = occupiedMinutes(scheduledAt, durationMinutes);
    try {
      return await this.requests.findOneAndUpdate({ id, status: 'accepted', ...(current.scheduleRevision === undefined ? { scheduleRevision: { $exists: false } } : { scheduleRevision: current.scheduleRevision }) }, { $set: { scheduledAt, durationMinutes, occupiedSlots, updatedAt: now }, $inc: { scheduleRevision: 1 }, $unset: { pendingSchedule: '' } }, { returnDocument: 'after', projection: { _id: 0 } });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new SlotConflictError('slot_conflict');
      throw error;
    }
  }

  async proposeSchedule(id: string, proposal: NonNullable<RequestRecord['pendingSchedule']>, revision?: number): Promise<RequestRecord | null> {
    return this.requests.findOneAndUpdate({ id, status: 'accepted', ...(revision === undefined ? { scheduleRevision: { $exists: false } } : { scheduleRevision: revision }) }, { $set: { pendingSchedule: proposal, updatedAt: new Date() }, $inc: { scheduleRevision: 1 } }, { returnDocument: 'after', projection: { _id: 0 } });
  }

  async deleteForUser(userId: string): Promise<void> {
    await this.requests.deleteMany({ $or: [{ ownerId: userId }, { professionalId: userId }] });
  }
}

// Stores requests in memory. Used by tests.
export class InMemoryRequestRepository implements RequestRepository {
  private readonly all: RequestRecord[] = [];

  async create(input: NewRequest, now = new Date()): Promise<RequestRecord> {
    if (this.all.some((r) => r.needId === input.needId && r.professionalId === input.professionalId && OPEN.includes(r.status))) throw new ActiveRequestExistsError('request_exists');
    const record: RequestRecord = { ...input, activeKey: JSON.stringify([input.needId, input.professionalId]), id: randomUUID(), status: 'pending', createdAt: now, updatedAt: now };
    this.all.push(record);
    return { ...record };
  }

  async findById(id: string): Promise<RequestRecord | null> {
    const found = this.all.find((r) => r.id === id);
    return found ? { ...found } : null;
  }

  async findActive(needId: string, professionalId: string): Promise<RequestRecord | null> {
    const found = this.all.find((r) => r.needId === needId && r.professionalId === professionalId && OPEN.includes(r.status));
    return found ? { ...found } : null;
  }

  async listByOwner(ownerId: string): Promise<RequestRecord[]> {
    return this.all.filter((r) => r.ownerId === ownerId).map((r) => ({ ...r })).reverse();
  }

  async listByProfessional(professionalId: string): Promise<RequestRecord[]> {
    return this.all.filter((r) => r.professionalId === professionalId).map((r) => ({ ...r })).reverse();
  }

  async setStatus(id: string, status: RequestStatus, now = new Date(), expectedStatus?: RequestStatus): Promise<RequestRecord | null> {
    const found = this.all.find((r) => r.id === id);
    if (!found || (expectedStatus && found.status !== expectedStatus)) return null;
    found.status = status;
    if (!OPEN.includes(status)) { delete found.occupiedSlots; delete found.activeKey; delete found.pendingSchedule; }
    found.updatedAt = now;
    return { ...found };
  }

  async setSchedule(id: string, scheduledAt: Date, durationMinutes: number, now = new Date(), expectedRevision?: number): Promise<RequestRecord | null> {
    const found = this.all.find((r) => r.id === id);
    if (!found || found.status !== 'accepted' || (expectedRevision !== undefined && found.scheduleRevision !== expectedRevision)) return null;
    if (this.all.some((r) => r.professionalId === found.professionalId && r.status === 'accepted' && r.scheduledAt && !r.occupiedSlots)) throw new LegacyScheduleError('legacy_schedule_requires_audit');
    const slots = occupiedMinutes(scheduledAt, durationMinutes);
    if (this.all.some((r) => r.id !== id && r.professionalId === found.professionalId && r.occupiedSlots?.some((slot) => slots.includes(slot)))) throw new SlotConflictError('slot_conflict');
    delete found.pendingSchedule;
    Object.assign(found, { scheduledAt, durationMinutes, occupiedSlots: slots, scheduleRevision: (found.scheduleRevision ?? 0) + 1, updatedAt: now });
    return { ...found };
  }

  async proposeSchedule(id: string, proposal: NonNullable<RequestRecord['pendingSchedule']>, revision?: number): Promise<RequestRecord | null> {
    const found = this.all.find((item) => item.id === id && item.status === 'accepted' && item.scheduleRevision === revision);
    if (!found) return null;
    found.pendingSchedule = proposal;
    found.scheduleRevision = (found.scheduleRevision ?? 0) + 1;
    found.updatedAt = new Date();
    return { ...found };
  }

  async deleteForUser(userId: string): Promise<void> {
    for (let i = this.all.length - 1; i >= 0; i--) {
      const r = this.all[i]!;
      if (r.ownerId === userId || r.professionalId === userId) this.all.splice(i, 1);
    }
  }
}

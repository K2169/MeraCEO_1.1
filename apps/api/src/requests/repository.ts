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
  status: RequestStatus;
  // When the consultation is planned to start. Set after the request is accepted; completing needs it to have passed.
  scheduledAt?: Date;
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
  setStatus(id: string, status: RequestStatus, now?: Date): Promise<RequestRecord | null>;
  setSchedule(id: string, scheduledAt: Date, now?: Date): Promise<RequestRecord | null>;
  // Removes every request this person sent or received (account deletion).
  deleteForUser(userId: string): Promise<void>;
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
  }

  async create(input: NewRequest, now = new Date()): Promise<RequestRecord> {
    const record: RequestRecord = { ...input, id: randomUUID(), status: 'pending', createdAt: now, updatedAt: now };
    await this.requests.insertOne({ ...record });
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

  async setStatus(id: string, status: RequestStatus, now = new Date()): Promise<RequestRecord | null> {
    return this.requests.findOneAndUpdate({ id }, { $set: { status, updatedAt: now } }, { returnDocument: 'after', projection: { _id: 0 } });
  }

  async setSchedule(id: string, scheduledAt: Date, now = new Date()): Promise<RequestRecord | null> {
    return this.requests.findOneAndUpdate({ id }, { $set: { scheduledAt, updatedAt: now } }, { returnDocument: 'after', projection: { _id: 0 } });
  }

  async deleteForUser(userId: string): Promise<void> {
    await this.requests.deleteMany({ $or: [{ ownerId: userId }, { professionalId: userId }] });
  }
}

// Stores requests in memory. Used by tests.
export class InMemoryRequestRepository implements RequestRepository {
  private readonly all: RequestRecord[] = [];

  async create(input: NewRequest, now = new Date()): Promise<RequestRecord> {
    const record: RequestRecord = { ...input, id: randomUUID(), status: 'pending', createdAt: now, updatedAt: now };
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

  async setStatus(id: string, status: RequestStatus, now = new Date()): Promise<RequestRecord | null> {
    const found = this.all.find((r) => r.id === id);
    if (!found) return null;
    found.status = status;
    found.updatedAt = now;
    return { ...found };
  }

  async setSchedule(id: string, scheduledAt: Date, now = new Date()): Promise<RequestRecord | null> {
    const found = this.all.find((r) => r.id === id);
    if (!found) return null;
    found.scheduledAt = scheduledAt;
    found.updatedAt = now;
    return { ...found };
  }

  async deleteForUser(userId: string): Promise<void> {
    for (let i = this.all.length - 1; i >= 0; i--) {
      const r = this.all[i]!;
      if (r.ownerId === userId || r.professionalId === userId) this.all.splice(i, 1);
    }
  }
}

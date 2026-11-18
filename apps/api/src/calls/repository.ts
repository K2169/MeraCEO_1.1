import { randomUUID } from 'node:crypto';

import type { Collection, Db } from 'mongodb';

export type CallStatus = 'ringing' | 'accepted' | 'declined' | 'ended' | 'missed';

export interface CallRecord {
  id: string;
  requestId: string;
  callerId: string;
  recipientId: string;
  activeKey?: string;
  status: CallStatus;
  createdAt: Date;
  expiresAt: Date;
}

export interface NewCall {
  requestId: string;
  callerId: string;
  recipientId: string;
}

export interface CallRepository {
  create(input: NewCall, now?: Date): Promise<CallRecord>;
  findById(id: string): Promise<CallRecord | null>;
  findIncoming(userId: string, now?: Date): Promise<CallRecord | null>;
  findActiveForRequest(requestId: string, now?: Date): Promise<CallRecord | null>;
  expireStaleForRequest(requestId: string, now?: Date): Promise<void>;
  transition(id: string, from: CallStatus[], status: CallStatus, expiresAt: Date): Promise<CallRecord | null>;
  deleteForUser(userId: string): Promise<void>;
}

// Call invitations are short-lived; the TTL index removes expired call state after the expiry time.
export class MongoCallRepository implements CallRepository {
  private readonly items: Collection<CallRecord>;

  constructor(db: Db) {
    this.items = db.collection<CallRecord>('calls');
  }

  async ensureIndexes(): Promise<void> {
    await this.items.createIndex({ id: 1 }, { unique: true });
    await this.items.createIndex({ requestId: 1, status: 1, expiresAt: 1 });
    await this.items.createIndex({ activeKey: 1 }, { unique: true, partialFilterExpression: { activeKey: { $exists: true } } });
    await this.items.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  }

  async create(input: NewCall, now = new Date()): Promise<CallRecord> {
    const record: CallRecord = { ...input, activeKey: input.requestId, id: randomUUID(), status: 'ringing', createdAt: now, expiresAt: new Date(now.getTime() + 60_000) };
    await this.items.insertOne(record);
    return record;
  }

  async findIncoming(userId: string, now = new Date()): Promise<CallRecord | null> {
    return this.items.findOne({ recipientId: userId, status: 'ringing', expiresAt: { $gt: now } }, { projection: { _id: 0 }, sort: { createdAt: -1 } });
  }

  async findById(id: string): Promise<CallRecord | null> {
    return this.items.findOne({ id }, { projection: { _id: 0 } });
  }

  async findActiveForRequest(requestId: string, now = new Date()): Promise<CallRecord | null> {
    return this.items.findOne({ requestId, status: { $in: ['ringing', 'accepted'] }, expiresAt: { $gt: now } }, { projection: { _id: 0 } });
  }

  async expireStaleForRequest(requestId: string, now = new Date()): Promise<void> {
    await this.items.updateMany(
      { requestId, status: { $in: ['ringing', 'accepted'] }, expiresAt: { $lte: now } },
      { $set: { status: 'missed' }, $unset: { activeKey: '' } },
    );
  }

  async transition(id: string, from: CallStatus[], status: CallStatus, expiresAt: Date): Promise<CallRecord | null> {
    const isActive = status === 'ringing' || status === 'accepted';
    const result = await this.items.updateOne(
      { id, status: { $in: from } },
      { $set: { status, expiresAt }, ...(isActive ? {} : { $unset: { activeKey: '' } }) },
    );
    return result.modifiedCount ? this.findById(id) : null;
  }

  async deleteForUser(userId: string): Promise<void> {
    await this.items.deleteMany({ $or: [{ callerId: userId }, { recipientId: userId }] });
  }
}

export class InMemoryCallRepository implements CallRepository {
  private items: CallRecord[] = [];

  async create(input: NewCall, now = new Date()): Promise<CallRecord> {
    const record: CallRecord = { ...input, activeKey: input.requestId, id: randomUUID(), status: 'ringing', createdAt: now, expiresAt: new Date(now.getTime() + 60_000) };
    this.items.push(record);
    return { ...record };
  }

  async findIncoming(userId: string, now = new Date()): Promise<CallRecord | null> {
    const record = this.items.find((item) => item.recipientId === userId && item.status === 'ringing' && item.expiresAt > now);
    return record ? { ...record } : null;
  }

  async findById(id: string): Promise<CallRecord | null> {
    const record = this.items.find((item) => item.id === id);
    return record ? { ...record } : null;
  }

  async findActiveForRequest(requestId: string, now = new Date()): Promise<CallRecord | null> {
    const record = this.items.find((item) => item.requestId === requestId
      && (item.status === 'ringing' || item.status === 'accepted') && item.expiresAt > now);
    return record ? { ...record } : null;
  }

  async expireStaleForRequest(requestId: string, now = new Date()): Promise<void> {
    for (const record of this.items) {
      if (record.requestId === requestId && (record.status === 'ringing' || record.status === 'accepted') && record.expiresAt <= now) {
        record.status = 'missed';
        delete record.activeKey;
      }
    }
  }

  async transition(id: string, from: CallStatus[], status: CallStatus, expiresAt: Date): Promise<CallRecord | null> {
    const record = this.items.find((item) => item.id === id && from.includes(item.status));
    if (!record) return null;
    record.status = status;
    record.expiresAt = expiresAt;
    if (status !== 'ringing' && status !== 'accepted') delete record.activeKey;
    return { ...record };
  }

  async deleteForUser(userId: string): Promise<void> {
    this.items = this.items.filter((item) => item.callerId !== userId && item.recipientId !== userId);
  }
}

import { createHash, randomUUID } from 'node:crypto';

import { needDuplicateIdentity, type CreateNeedInput } from '@meraceo/shared';
import type { Collection, Db } from 'mongodb';

// Onboarding and older data may not yet include a timeline. API create/edit validates the full contract.
type StoredNeedInput = Omit<CreateNeedInput, 'timeline'> & { timeline?: string };

// A business need saved by an owner.
export interface NeedRecord extends Omit<CreateNeedInput, 'timeline'> {
  // Legacy records predate required timelines; edits must provide one.
  timeline?: string;
  updatedAt?: Date;
  id: string;
  ownerId: string;
  // Present on newly written records. Older records are checked by their normalized fields.
  dedupeKey?: string;
  status: 'open' | 'closed';
  createdAt: Date;
}

export interface NeedRepository {
  create(ownerId: string, input: StoredNeedInput, now?: Date): Promise<NeedRecord>;
  // Newest first.
  listByOwner(ownerId: string): Promise<NeedRecord[]>;
  findById(id: string): Promise<NeedRecord | null>;
  update(ownerId: string, id: string, input: CreateNeedInput, now?: Date): Promise<NeedRecord | null>;
  close(ownerId: string, id: string, now?: Date): Promise<NeedRecord | null>;
  deleteByOwner(ownerId: string): Promise<void>;
  // Every open need from every owner, newest first (the professionals' opportunity feed).
  listOpen(): Promise<NeedRecord[]>;
}

export class DuplicateNeedError extends Error {
  constructor() {
    super('duplicate_need');
    this.name = 'DuplicateNeedError';
  }
}

function dedupeKey(input: StoredNeedInput): string {
  const identity = needDuplicateIdentity(input);
  if (!identity) throw new Error('Need identity fields are required');
  return createHash('sha256').update(identity).digest('hex');
}

function isDuplicateNeedIndexError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const mongoError = error as { code?: number; keyPattern?: Record<string, unknown> };
  return mongoError.code === 11000 && Boolean(mongoError.keyPattern?.dedupeKey);
}

// Stores needs in MongoDB.
export class MongoNeedRepository implements NeedRepository {
  private readonly needs: Collection<NeedRecord>;

  constructor(db: Db) {
    this.needs = db.collection<NeedRecord>('needs');
  }

  async ensureIndexes(): Promise<void> {
    await this.needs.createIndex({ id: 1 }, { unique: true });
    await this.needs.createIndex({ ownerId: 1, createdAt: -1 });
    // Legacy documents without dedupeKey remain outside this index and are checked in application code.
    await this.needs.createIndex(
      { ownerId: 1, dedupeKey: 1 },
      { unique: true, partialFilterExpression: { status: 'open', dedupeKey: { $exists: true } } },
    );
  }

  async create(ownerId: string, input: StoredNeedInput, now = new Date()): Promise<NeedRecord> {
    const key = dedupeKey(input);
    if (await this.findOpenDuplicate(ownerId, input)) throw new DuplicateNeedError();
    const record: NeedRecord = { ...input, dedupeKey: key, id: randomUUID(), ownerId, status: 'open', createdAt: now };
    try {
      await this.needs.insertOne({ ...record });
      return record;
    } catch (error) {
      if (isDuplicateNeedIndexError(error)) throw new DuplicateNeedError();
      throw error;
    }
  }

  async listByOwner(ownerId: string): Promise<NeedRecord[]> {
    return this.needs.find({ ownerId }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
  }

  async findById(id: string): Promise<NeedRecord | null> {
    return this.needs.findOne({ id }, { projection: { _id: 0 } });
  }

  // Update only an open need belonging to this owner; edits feed live matching.
  async update(ownerId: string, id: string, input: CreateNeedInput, now = new Date()): Promise<NeedRecord | null> {
    const key = dedupeKey(input);
    if (await this.findOpenDuplicate(ownerId, input, id)) throw new DuplicateNeedError();
    const fields = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
    const unset = Object.fromEntries(['budgetBand', 'goals', 'format'].filter((key) => input[key as keyof CreateNeedInput] === undefined).map((key) => [key, '' as const]));
    try {
      return await this.needs.findOneAndUpdate({ id, ownerId, status: 'open' }, { $set: { ...fields, dedupeKey: key, updatedAt: now }, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { returnDocument: 'after', projection: { _id: 0 } });
    } catch (error) {
      if (isDuplicateNeedIndexError(error)) throw new DuplicateNeedError();
      throw error;
    }
  }

  private async findOpenDuplicate(ownerId: string, input: StoredNeedInput, excludeId?: string): Promise<NeedRecord | null> {
    const identity = needDuplicateIdentity(input);
    if (!identity) return null;
    const candidates = await this.needs.find({ ownerId, status: 'open', ...(excludeId ? { id: { $ne: excludeId } } : {}) }).toArray();
    return candidates.find((need) => needDuplicateIdentity(need) === identity) ?? null;
  }

  // Closing removes a need from discovery while preserving linked requests.
  async close(ownerId: string, id: string, now = new Date()): Promise<NeedRecord | null> {
    return this.needs.findOneAndUpdate({ id, ownerId }, { $set: { status: 'closed', updatedAt: now } }, { returnDocument: 'after', projection: { _id: 0 } });
  }

  async deleteByOwner(ownerId: string): Promise<void> {
    await this.needs.deleteMany({ ownerId });
  }

  async listOpen(): Promise<NeedRecord[]> {
    return this.needs.find({ status: 'open' }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(200).toArray();
  }
}

// Stores needs in memory. Used by tests.
export class InMemoryNeedRepository implements NeedRepository {
  private readonly all: NeedRecord[] = [];

  async create(ownerId: string, input: StoredNeedInput, now = new Date()): Promise<NeedRecord> {
    if (this.findOpenDuplicate(ownerId, input)) throw new DuplicateNeedError();
    const record: NeedRecord = { ...input, dedupeKey: dedupeKey(input), id: randomUUID(), ownerId, status: 'open', createdAt: now };
    this.all.push(record);
    return { ...record };
  }

  async listByOwner(ownerId: string): Promise<NeedRecord[]> {
    return this.all.filter((n) => n.ownerId === ownerId).map((n) => ({ ...n })).reverse();
  }

  async findById(id: string): Promise<NeedRecord | null> {
    const found = this.all.find((n) => n.id === id);
    return found ? { ...found } : null;
  }

  async update(ownerId: string, id: string, input: CreateNeedInput, now = new Date()): Promise<NeedRecord | null> {
    const index = this.all.findIndex((need) => need.id === id && need.ownerId === ownerId && need.status === 'open');
    if (index < 0) return null;
    if (this.findOpenDuplicate(ownerId, input, id)) throw new DuplicateNeedError();
    const existing = this.all[index]!;
    const updated: NeedRecord = { ...input, dedupeKey: dedupeKey(input), id: existing.id, ownerId, status: 'open', createdAt: existing.createdAt, updatedAt: now };
    this.all[index] = updated;
    return { ...updated };
  }

  async close(ownerId: string, id: string, now = new Date()): Promise<NeedRecord | null> {
    const existing = this.all.find((need) => need.id === id && need.ownerId === ownerId);
    if (!existing) return null;
    existing.status = 'closed';
    existing.updatedAt = now;
    return { ...existing };
  }

  async deleteByOwner(ownerId: string): Promise<void> {
    for (let i = this.all.length - 1; i >= 0; i--) if (this.all[i]!.ownerId === ownerId) this.all.splice(i, 1);
  }

  private findOpenDuplicate(ownerId: string, input: StoredNeedInput, excludeId?: string): NeedRecord | undefined {
    const identity = needDuplicateIdentity(input);
    if (!identity) return undefined;
    return this.all.find((need) => need.ownerId === ownerId
      && need.status === 'open'
      && need.id !== excludeId
      && needDuplicateIdentity(need) === identity);
  }

  async listOpen(): Promise<NeedRecord[]> {
    return this.all.filter((n) => n.status === 'open').map((n) => ({ ...n })).reverse();
  }
}

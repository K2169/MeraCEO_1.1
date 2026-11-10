import { randomUUID } from 'node:crypto';

import type { CreateNeedInput } from '@meraceo/shared';
import type { Collection, Db } from 'mongodb';

// A business need saved by an owner.
export interface NeedRecord extends CreateNeedInput {
  id: string;
  ownerId: string;
  status: 'open' | 'closed';
  createdAt: Date;
}

export interface NeedRepository {
  create(ownerId: string, input: CreateNeedInput, now?: Date): Promise<NeedRecord>;
  // Newest first.
  listByOwner(ownerId: string): Promise<NeedRecord[]>;
  findById(id: string): Promise<NeedRecord | null>;
  deleteByOwner(ownerId: string): Promise<void>;
  // Every open need from every owner, newest first (the professionals' opportunity feed).
  listOpen(): Promise<NeedRecord[]>;
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
  }

  async create(ownerId: string, input: CreateNeedInput, now = new Date()): Promise<NeedRecord> {
    const record: NeedRecord = { ...input, id: randomUUID(), ownerId, status: 'open', createdAt: now };
    await this.needs.insertOne({ ...record });
    return record;
  }

  async listByOwner(ownerId: string): Promise<NeedRecord[]> {
    return this.needs.find({ ownerId }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
  }

  async findById(id: string): Promise<NeedRecord | null> {
    return this.needs.findOne({ id }, { projection: { _id: 0 } });
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

  async create(ownerId: string, input: CreateNeedInput, now = new Date()): Promise<NeedRecord> {
    const record: NeedRecord = { ...input, id: randomUUID(), ownerId, status: 'open', createdAt: now };
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

  async deleteByOwner(ownerId: string): Promise<void> {
    for (let i = this.all.length - 1; i >= 0; i--) if (this.all[i]!.ownerId === ownerId) this.all.splice(i, 1);
  }

  async listOpen(): Promise<NeedRecord[]> {
    return this.all.filter((n) => n.status === 'open').map((n) => ({ ...n })).reverse();
  }
}

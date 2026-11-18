import { randomUUID } from 'node:crypto';
import type { Collection, Db } from 'mongodb';

export type GrievanceCategory = 'technical' | 'account' | 'privacy' | 'consultation' | 'other';
export interface GrievanceInput { userId: string; category: GrievanceCategory; message: string; requestId?: string; idempotencyKey: string }
export interface GrievanceRecord extends GrievanceInput { id: string; status: 'received'; createdAt: Date }
export interface GrievanceRepository { create(input: GrievanceInput, now?: Date): Promise<GrievanceRecord> }

// Reports stay private; the unique reporter/key pair makes network retries safe.
export class MongoGrievanceRepository implements GrievanceRepository {
  private readonly items: Collection<GrievanceRecord>;
  constructor(db: Db) { this.items = db.collection<GrievanceRecord>('grievances'); }
  async ensureIndexes(): Promise<void> {
    await this.items.createIndex({ userId: 1, idempotencyKey: 1 }, { unique: true });
    await this.items.createIndex({ id: 1 }, { unique: true });
  }
  async create(input: GrievanceInput, now = new Date()): Promise<GrievanceRecord> {
    const record: GrievanceRecord = { ...input, id: randomUUID(), status: 'received', createdAt: now };
    try {
      const saved = await this.items.findOneAndUpdate({ userId: input.userId, idempotencyKey: input.idempotencyKey }, { $setOnInsert: record }, { upsert: true, returnDocument: 'after', projection: { _id: 0 } });
      if (!saved) throw new Error('Report not saved');
      return saved;
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      const saved = await this.items.findOne({ userId: input.userId, idempotencyKey: input.idempotencyKey }, { projection: { _id: 0 } });
      if (!saved) throw error;
      return saved;
    }
  }
}

// In-memory equivalent used to verify authorization and duplicate retry behavior.
export class InMemoryGrievanceRepository implements GrievanceRepository {
  private readonly items = new Map<string, GrievanceRecord>();
  async create(input: GrievanceInput, now = new Date()): Promise<GrievanceRecord> {
    const key = JSON.stringify([input.userId, input.idempotencyKey]);
    const existing = this.items.get(key);
    if (existing) return { ...existing };
    const record: GrievanceRecord = { ...input, id: randomUUID(), status: 'received', createdAt: now };
    this.items.set(key, record);
    return { ...record };
  }
}

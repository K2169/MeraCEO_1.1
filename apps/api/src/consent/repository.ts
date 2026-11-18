import { createHash, randomUUID } from 'node:crypto';

import { ObjectId, type Collection, type Db } from 'mongodb';

// Plan W3-04: one event per consent choice. Events are only ever inserted, never updated or deleted.
export const CONSENT_TYPES = ['matching', 'contact_sharing', 'notifications', 'terms'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export interface ConsentEvent {
  id: string;
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  noticeVersion: string;
  createdAt: Date;
}

// An optional stable key lets registration retries re-use the same append-only events.
// Subsequent preference changes use a new key and are still recorded as new events.
export type ConsentWrite = Omit<ConsentEvent, 'id' | 'createdAt'> & { idempotencyKey?: string };

export interface ConsentRepository {
  record(events: ConsentWrite[], now?: Date): Promise<void>;
  listForUser(userId: string): Promise<ConsentEvent[]>;
}

// Stores consent choices in MongoDB. Only inserts, never updates or deletes.
export class MongoConsentRepository implements ConsentRepository {
  private readonly events: Collection<ConsentEvent>;

  constructor(db: Db) {
    this.events = db.collection<ConsentEvent>('consent_events');
  }

  async record(events: ConsentWrite[], now = new Date()): Promise<void> {
    if (events.length === 0) return;
    for (const event of events) {
      const { idempotencyKey, ...choice } = event;
      const stableId = idempotencyKey
        ? createHash('sha256').update(`${choice.userId}:${idempotencyKey}:${choice.noticeVersion}:${choice.consentType}`).digest('hex')
        : randomUUID();
      const document = {
        ...choice,
        id: stableId,
        ...(idempotencyKey ? { _id: ObjectId.createFromHexString(stableId.slice(0, 24)) } : {}),
        createdAt: now,
      };
      try {
        await this.events.insertOne(document);
      } catch (error) {
        // Mongo's built-in unique _id constraint makes concurrent retries safe without
        // mutating or replacing the original append-only consent event.
        if (idempotencyKey && isDuplicateKeyError(error)) continue;
        throw error;
      }
    }
  }

  async listForUser(userId: string): Promise<ConsentEvent[]> {
    return this.events.find({ userId }).sort({ createdAt: 1 }).toArray();
  }
}

// Stores consent choices in memory. Used by tests.
export class InMemoryConsentRepository implements ConsentRepository {
  private readonly all: ConsentEvent[] = [];
  private readonly idempotencyKeys = new Set<string>();

  async record(events: ConsentWrite[], now = new Date()): Promise<void> {
    for (const event of events) {
      const { idempotencyKey, ...choice } = event;
      const idempotencyId = idempotencyKey
        ? `${choice.userId}:${idempotencyKey}:${choice.noticeVersion}:${choice.consentType}`
        : null;
      if (idempotencyId && this.idempotencyKeys.has(idempotencyId)) continue;
      if (idempotencyId) this.idempotencyKeys.add(idempotencyId);
      this.all.push({ ...choice, id: idempotencyId ?? randomUUID(), createdAt: now });
    }
  }

  async listForUser(userId: string): Promise<ConsentEvent[]> {
    return this.all.filter((e) => e.userId === userId).map((e) => ({ ...e }));
  }
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 11000;
}

import { randomUUID } from 'node:crypto';

import type { Collection, Db } from 'mongodb';

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

export interface ConsentRepository {
  record(events: Omit<ConsentEvent, 'id' | 'createdAt'>[], now?: Date): Promise<void>;
  listForUser(userId: string): Promise<ConsentEvent[]>;
}

// Stores consent choices in MongoDB. Only inserts, never updates or deletes.
export class MongoConsentRepository implements ConsentRepository {
  private readonly events: Collection<ConsentEvent>;

  constructor(db: Db) {
    this.events = db.collection<ConsentEvent>('consent_events');
  }

  async record(events: Omit<ConsentEvent, 'id' | 'createdAt'>[], now = new Date()): Promise<void> {
    if (events.length === 0) return;
    await this.events.insertMany(events.map((e) => ({ ...e, id: randomUUID(), createdAt: now })));
  }

  async listForUser(userId: string): Promise<ConsentEvent[]> {
    return this.events.find({ userId }).sort({ createdAt: 1 }).toArray();
  }
}

// Stores consent choices in memory. Used by tests.
export class InMemoryConsentRepository implements ConsentRepository {
  private readonly all: ConsentEvent[] = [];

  async record(events: Omit<ConsentEvent, 'id' | 'createdAt'>[], now = new Date()): Promise<void> {
    for (const e of events) this.all.push({ ...e, id: randomUUID(), createdAt: now });
  }

  async listForUser(userId: string): Promise<ConsentEvent[]> {
    return this.all.filter((e) => e.userId === userId).map((e) => ({ ...e }));
  }
}

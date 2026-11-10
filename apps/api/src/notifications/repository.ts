import { randomUUID } from 'node:crypto';

import type { Collection, Db } from 'mongodb';

export type NotificationType = 'request_received' | 'request_accepted' | 'request_declined' | 'request_cancelled' | 'consultation_scheduled' | 'consultation_completed';

// One message for one person, shown in the app's notification list. The names are stored on the record so
// the list never needs to look other people up.
export interface NotificationRecord {
  id: string;
  userId: string; // who it is for
  type: NotificationType;
  requestId: string;
  actorName: string; // who did the thing
  needTitle: string;
  createdAt: Date;
  readAt: Date | null;
}

export type NewNotification = Omit<NotificationRecord, 'id' | 'createdAt' | 'readAt'>;

export interface NotificationRepository {
  create(input: NewNotification, now?: Date): Promise<NotificationRecord>;
  // Newest first.
  listForUser(userId: string, limit?: number): Promise<NotificationRecord[]>;
  countUnread(userId: string): Promise<number>;
  markAllRead(userId: string, now?: Date): Promise<void>;
  deleteForUser(userId: string): Promise<void>;
}

// Stores notifications in MongoDB.
export class MongoNotificationRepository implements NotificationRepository {
  private readonly items: Collection<NotificationRecord>;

  constructor(db: Db) {
    this.items = db.collection<NotificationRecord>('notifications');
  }

  async ensureIndexes(): Promise<void> {
    await this.items.createIndex({ userId: 1, createdAt: -1 });
  }

  async create(input: NewNotification, now = new Date()): Promise<NotificationRecord> {
    const record: NotificationRecord = { ...input, id: randomUUID(), createdAt: now, readAt: null };
    await this.items.insertOne({ ...record });
    return record;
  }

  async listForUser(userId: string, limit = 50): Promise<NotificationRecord[]> {
    return this.items.find({ userId }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(limit).toArray();
  }

  async countUnread(userId: string): Promise<number> {
    return this.items.countDocuments({ userId, readAt: null });
  }

  async markAllRead(userId: string, now = new Date()): Promise<void> {
    await this.items.updateMany({ userId, readAt: null }, { $set: { readAt: now } });
  }

  async deleteForUser(userId: string): Promise<void> {
    await this.items.deleteMany({ userId });
  }
}

// Stores notifications in memory. Used by tests.
export class InMemoryNotificationRepository implements NotificationRepository {
  private all: NotificationRecord[] = [];

  async create(input: NewNotification, now = new Date()): Promise<NotificationRecord> {
    const record: NotificationRecord = { ...input, id: randomUUID(), createdAt: now, readAt: null };
    this.all.push(record);
    return { ...record };
  }

  async listForUser(userId: string, limit = 50): Promise<NotificationRecord[]> {
    return this.all.filter((n) => n.userId === userId).map((n) => ({ ...n })).reverse().slice(0, limit);
  }

  async countUnread(userId: string): Promise<number> {
    return this.all.filter((n) => n.userId === userId && n.readAt === null).length;
  }

  async markAllRead(userId: string, now = new Date()): Promise<void> {
    for (const n of this.all) if (n.userId === userId && n.readAt === null) n.readAt = now;
  }

  async deleteForUser(userId: string): Promise<void> {
    this.all = this.all.filter((n) => n.userId !== userId);
  }
}

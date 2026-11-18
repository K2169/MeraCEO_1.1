import { randomUUID } from 'node:crypto';

import type { Collection, Db } from 'mongodb';

export interface MessageRecord {
  id: string;
  requestId: string;
  senderId: string;
  recipientId: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
}

export interface NewMessage {
  requestId: string;
  senderId: string;
  recipientId: string;
  body: string;
}

export interface MessageRepository {
  create(input: NewMessage, now?: Date): Promise<MessageRecord>;
  listForRequest(requestId: string, limit?: number): Promise<MessageRecord[]>;
  latestForRequests(requestIds: string[]): Promise<Map<string, MessageRecord>>;
  countUnread(requestIds: string[], recipientId: string): Promise<Map<string, number>>;
  markRead(requestId: string, recipientId: string, now?: Date): Promise<void>;
  deleteForUser(userId: string): Promise<void>;
}

// Messages are separate records. The request ID is the conversation key and limits access to its two parties.
export class MongoMessageRepository implements MessageRepository {
  private readonly items: Collection<MessageRecord>;

  constructor(db: Db) {
    this.items = db.collection<MessageRecord>('messages');
  }

  async ensureIndexes(): Promise<void> {
    await this.items.createIndex({ requestId: 1, createdAt: 1, id: 1 });
    await this.items.createIndex({ recipientId: 1, requestId: 1, readAt: 1 });
  }

  async create(input: NewMessage, now = new Date()): Promise<MessageRecord> {
    const message: MessageRecord = { ...input, id: randomUUID(), createdAt: now, readAt: null };
    await this.items.insertOne({ ...message });
    return message;
  }

  async listForRequest(requestId: string, limit = 100): Promise<MessageRecord[]> {
    const newestFirst = await this.items.find({ requestId }, { projection: { _id: 0 } })
      .sort({ createdAt: -1, id: -1 }).limit(limit).toArray();
    return newestFirst.reverse();
  }

  async latestForRequests(requestIds: string[]): Promise<Map<string, MessageRecord>> {
    if (!requestIds.length) return new Map();
    const rows = await this.items.aggregate<MessageRecord>([
      { $match: { requestId: { $in: requestIds } } },
      { $sort: { createdAt: -1, id: -1 } },
      { $group: { _id: '$requestId', message: { $first: '$$ROOT' } } },
      { $replaceRoot: { newRoot: '$message' } },
      { $project: { _id: 0 } },
    ]).toArray();
    return new Map(rows.map((row) => [row.requestId, row]));
  }

  async countUnread(requestIds: string[], recipientId: string): Promise<Map<string, number>> {
    if (!requestIds.length) return new Map();
    const rows = await this.items.aggregate<{ _id: string; count: number }>([
      { $match: { requestId: { $in: requestIds }, recipientId, readAt: null } },
      { $group: { _id: '$requestId', count: { $sum: 1 } } },
    ]).toArray();
    return new Map(rows.map((row) => [row._id, row.count]));
  }

  async markRead(requestId: string, recipientId: string, now = new Date()): Promise<void> {
    await this.items.updateMany({ requestId, recipientId, readAt: null }, { $set: { readAt: now } });
  }

  async deleteForUser(userId: string): Promise<void> {
    await this.items.deleteMany({ $or: [{ senderId: userId }, { recipientId: userId }] });
  }
}

// In-memory implementation keeps route behavior covered without requiring MongoDB in tests.
export class InMemoryMessageRepository implements MessageRepository {
  private items: MessageRecord[] = [];

  async create(input: NewMessage, now = new Date()): Promise<MessageRecord> {
    const message: MessageRecord = { ...input, id: randomUUID(), createdAt: now, readAt: null };
    this.items.push(message);
    return { ...message };
  }

  async listForRequest(requestId: string, limit = 100): Promise<MessageRecord[]> {
    return this.items.filter((item) => item.requestId === requestId).slice(-limit).map((item) => ({ ...item }));
  }

  async latestForRequests(requestIds: string[]): Promise<Map<string, MessageRecord>> {
    const wanted = new Set(requestIds);
    const latest = new Map<string, MessageRecord>();
    for (const message of this.items) if (wanted.has(message.requestId)) latest.set(message.requestId, { ...message });
    return latest;
  }

  async countUnread(requestIds: string[], recipientId: string): Promise<Map<string, number>> {
    const wanted = new Set(requestIds);
    const unread = new Map<string, number>();
    for (const message of this.items) {
      if (wanted.has(message.requestId) && message.recipientId === recipientId && message.readAt === null) {
        unread.set(message.requestId, (unread.get(message.requestId) ?? 0) + 1);
      }
    }
    return unread;
  }

  async markRead(requestId: string, recipientId: string, now = new Date()): Promise<void> {
    for (const message of this.items) if (message.requestId === requestId && message.recipientId === recipientId && message.readAt === null) message.readAt = now;
  }

  async deleteForUser(userId: string): Promise<void> {
    this.items = this.items.filter((item) => item.senderId !== userId && item.recipientId !== userId);
  }
}

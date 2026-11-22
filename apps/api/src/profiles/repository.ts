import type { Collection, Db } from 'mongodb';

import type { Role } from '../users/repository.js';

// What onboarding saves for one person. `data` is the already-checked onboarding form
// (owner or professional, depending on `role`).
export interface ProfileRecord {
  userId: string;
  role: Role;
  data: Record<string, unknown>;
  // Professionals are only shown to owners once approved (PRD section 06). Owners are always 'approved'.
  moderation: 'pending_review' | 'approved' | 'hidden';
  // A professional can pause new matches. Defaults to open.
  available: boolean;
  // Storage key of the profile photo (professionals) or logo (owners), when one has been added.
  photoKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProfileRepository {
  // Creates the profile, or replaces its answers if one already exists.
  save(userId: string, role: Role, data: Record<string, unknown>, now?: Date): Promise<ProfileRecord>;
  findByUserId(userId: string): Promise<ProfileRecord | null>;
  // Marks the signed-in professional's own profile approved for testing.
  approve(userId: string): Promise<boolean>;
  // Professionals who are approved and open to new requests: the pool matching ranks.
  listMatchable(): Promise<ProfileRecord[]>;
  setPhotoKey(userId: string, key: string | null): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}

// New profiles are visible immediately. Existing moderation states stay unchanged on edits.
const startingModeration = () => 'approved' as const;

// Stores profiles in MongoDB, one document per user.
export class MongoProfileRepository implements ProfileRepository {
  private readonly profiles: Collection<ProfileRecord>;

  constructor(db: Db) {
    this.profiles = db.collection<ProfileRecord>('profiles');
  }

  // One profile per user, enforced by a unique index (idempotent).
  async ensureIndexes(): Promise<void> {
    await this.profiles.createIndex({ userId: 1 }, { unique: true });
  }

  async save(userId: string, role: Role, data: Record<string, unknown>, now = new Date()): Promise<ProfileRecord> {
    const saved = await this.profiles.findOneAndUpdate(
      { userId },
      {
        $set: { role, data, updatedAt: now },
        // Review status and availability are set once. Editing answers later never re-approves or resets them.
        $setOnInsert: { userId, createdAt: now, moderation: startingModeration(), available: true },
      },
      { upsert: true, returnDocument: 'after' },
    );
    if (!saved) throw new Error('profile upsert returned no document');
    return saved;
  }

  async findByUserId(userId: string): Promise<ProfileRecord | null> {
    return this.profiles.findOne({ userId });
  }

  async approve(userId: string): Promise<boolean> {
    const result = await this.profiles.updateOne(
      { userId, role: 'professional' },
      { $set: { moderation: 'approved', updatedAt: new Date() } },
    );
    return result.matchedCount > 0;
  }

  async listMatchable(): Promise<ProfileRecord[]> {
    return this.profiles.find({ role: 'professional', moderation: 'approved', available: true }).toArray();
  }

  async setPhotoKey(userId: string, key: string | null): Promise<void> {
    await this.profiles.updateOne({ userId }, key ? { $set: { photoKey: key } } : { $unset: { photoKey: '' } });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.profiles.deleteOne({ userId });
  }
}

// Stores profiles in memory. Used by tests.
export class InMemoryProfileRepository implements ProfileRepository {
  private readonly byUser = new Map<string, ProfileRecord>();

  async save(userId: string, role: Role, data: Record<string, unknown>, now = new Date()): Promise<ProfileRecord> {
    const existing = this.byUser.get(userId);
    const record: ProfileRecord = {
      userId,
      role,
      data,
      moderation: existing?.moderation ?? startingModeration(),
      available: existing?.available ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.byUser.set(userId, record);
    return { ...record };
  }

  async findByUserId(userId: string): Promise<ProfileRecord | null> {
    const record = this.byUser.get(userId);
    return record ? { ...record } : null;
  }

  async listMatchable(): Promise<ProfileRecord[]> {
    return [...this.byUser.values()].filter((p) => p.role === 'professional' && p.moderation === 'approved' && p.available);
  }

  async setPhotoKey(userId: string, key: string | null): Promise<void> {
    const record = this.byUser.get(userId);
    if (!record) return;
    if (key) record.photoKey = key;
    else delete record.photoKey;
  }

  async deleteByUserId(userId: string): Promise<void> {
    this.byUser.delete(userId);
  }

  // Marks a professional profile approved, like a reviewer would.
  async approve(userId: string): Promise<boolean> {
    const record = this.byUser.get(userId);
    if (!record || record.role !== 'professional') return false;
    record.moderation = 'approved';
    record.updatedAt = new Date();
    return true;
  }
}

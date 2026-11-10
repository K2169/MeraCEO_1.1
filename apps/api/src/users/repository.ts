import { randomUUID } from 'node:crypto';

import type { Collection, Db } from 'mongodb';

import type { GoogleIdentity } from '../auth/google.js';

export type Role = 'owner' | 'professional';

// Server-side user record. The email is personal data: it is never logged and never returned by the API.
export interface UserRecord {
  id: string;
  googleSub: string;
  email: string;
  name: string | null;
  role: Role | null;
  ageConfirmed: boolean | null;
  ageConfirmedAt: Date | null;
  dateOfBirth: string | null;
  createdAt: Date;
  lastSignInAt: Date;
}

// Thrown when someone tries to set a role a second time.
export class RoleAlreadySetError extends Error {
  constructor() {
    super('role_already_set');
  }
}

export interface UserRepository {
  upsertFromGoogle(identity: GoogleIdentity, now?: Date): Promise<UserRecord>;
  findById(id: string): Promise<UserRecord | null>;
  // Sets the role once. Throws RoleAlreadySetError if a role already exists.
  setRoleOnce(id: string, role: Role): Promise<UserRecord | null>;
  // Stores the person's ISO calendar date and the age check result.
  setDateOfBirth(id: string, dateOfBirth: string, isAdult: boolean, now?: Date): Promise<UserRecord | null>;
  // Permanently removes the user record (account deletion).
  deleteById(id: string): Promise<void>;
}

// Reads and writes user records in MongoDB.
export class MongoUserRepository implements UserRepository {
  private readonly users: Collection<UserRecord>;

  constructor(db: Db) {
    this.users = db.collection<UserRecord>('users');
  }

  // Creates the unique indexes once at startup (idempotent).
  async ensureIndexes(): Promise<void> {
    await this.users.createIndex({ googleSub: 1 }, { unique: true });
    await this.users.createIndex({ id: 1 }, { unique: true });
  }

  async upsertFromGoogle(identity: GoogleIdentity, now = new Date()): Promise<UserRecord> {
    const result = await this.users.findOneAndUpdate(
      { googleSub: identity.sub },
      {
        $set: { email: identity.email, name: identity.name ?? null, lastSignInAt: now },
        $setOnInsert: {
          id: randomUUID(),
          googleSub: identity.sub,
          role: null,
          ageConfirmed: null,
          ageConfirmedAt: null,
          dateOfBirth: null,
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    if (!result) throw new Error('user upsert returned no document');
    return result;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.findOne({ id });
  }

  async setRoleOnce(id: string, role: Role): Promise<UserRecord | null> {
    // The filter requires role to be null, so a second write matches nothing and is rejected.
    const updated = await this.users.findOneAndUpdate(
      { id, role: null },
      { $set: { role } },
      { returnDocument: 'after' },
    );
    if (updated) return updated;
    const existing = await this.findById(id);
    if (existing?.role) throw new RoleAlreadySetError();
    return null;
  }

  // Persists a validated birth date and the server-computed age check.
  async setDateOfBirth(id: string, dateOfBirth: string, isAdult: boolean, now = new Date()): Promise<UserRecord | null> {
    return this.users.findOneAndUpdate(
      { id },
      { $set: { dateOfBirth, ageConfirmed: isAdult, ageConfirmedAt: now } },
      { returnDocument: 'after' },
    );
  }

  async deleteById(id: string): Promise<void> {
    await this.users.deleteOne({ id });
  }
}

// Used by tests and local runs without MongoDB. Same behaviour as the Mongo version.
export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, UserRecord>();
  private readonly bySub = new Map<string, string>();

  async upsertFromGoogle(identity: GoogleIdentity, now = new Date()): Promise<UserRecord> {
    const existingId = this.bySub.get(identity.sub);
    if (existingId) {
      const user = this.byId.get(existingId)!;
      Object.assign(user, { email: identity.email, name: identity.name ?? null, lastSignInAt: now });
      return { ...user };
    }
    const user: UserRecord = {
      id: randomUUID(),
      googleSub: identity.sub,
      email: identity.email,
      name: identity.name ?? null,
      role: null,
      ageConfirmed: null,
      ageConfirmedAt: null,
      dateOfBirth: null,
      createdAt: now,
      lastSignInAt: now,
    };
    this.byId.set(user.id, user);
    this.bySub.set(identity.sub, user.id);
    return { ...user };
  }

  async findById(id: string): Promise<UserRecord | null> {
    const user = this.byId.get(id);
    return user ? { ...user } : null;
  }

  async setRoleOnce(id: string, role: Role): Promise<UserRecord | null> {
    const user = this.byId.get(id);
    if (!user) return null;
    if (user.role) throw new RoleAlreadySetError();
    user.role = role;
    return { ...user };
  }

  // Persists a validated birth date and the server-computed age check.
  async setDateOfBirth(id: string, dateOfBirth: string, isAdult: boolean, now = new Date()): Promise<UserRecord | null> {
    const user = this.byId.get(id);
    if (!user) return null;
    user.dateOfBirth = dateOfBirth;
    user.ageConfirmed = isAdult;
    user.ageConfirmedAt = now;
    return { ...user };
  }

  async deleteById(id: string): Promise<void> {
    const user = this.byId.get(id);
    if (!user) return;
    this.bySub.delete(user.googleSub);
    this.byId.delete(id);
  }
}

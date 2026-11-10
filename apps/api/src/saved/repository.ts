import type { Collection, Db } from 'mongodb';

// A professional an owner has saved to come back to. Only the two ids are stored.
export interface SavedRecord {
  ownerId: string;
  professionalId: string;
  savedAt: Date;
}

export interface SavedRepository {
  // Saving the same person twice changes nothing.
  add(ownerId: string, professionalId: string, now?: Date): Promise<void>;
  remove(ownerId: string, professionalId: string): Promise<void>;
  // The ids an owner has saved, newest first.
  listForOwner(ownerId: string): Promise<string[]>;
  deleteForOwner(ownerId: string): Promise<void>;
  // Used when a professional deletes their account, so nobody keeps a dead link.
  deleteForProfessional(professionalId: string): Promise<void>;
}

// Stores saved professionals in MongoDB.
export class MongoSavedRepository implements SavedRepository {
  private readonly items: Collection<SavedRecord>;

  constructor(db: Db) {
    this.items = db.collection<SavedRecord>('saved_professionals');
  }

  async ensureIndexes(): Promise<void> {
    await this.items.createIndex({ ownerId: 1, professionalId: 1 }, { unique: true });
    await this.items.createIndex({ professionalId: 1 });
  }

  async add(ownerId: string, professionalId: string, now = new Date()): Promise<void> {
    await this.items.updateOne({ ownerId, professionalId }, { $setOnInsert: { ownerId, professionalId, savedAt: now } }, { upsert: true });
  }

  async remove(ownerId: string, professionalId: string): Promise<void> {
    await this.items.deleteOne({ ownerId, professionalId });
  }

  async listForOwner(ownerId: string): Promise<string[]> {
    return (await this.items.find({ ownerId }).sort({ savedAt: -1 }).toArray()).map((r) => r.professionalId);
  }

  async deleteForOwner(ownerId: string): Promise<void> {
    await this.items.deleteMany({ ownerId });
  }

  async deleteForProfessional(professionalId: string): Promise<void> {
    await this.items.deleteMany({ professionalId });
  }
}

// Stores saved professionals in memory. Used by tests.
export class InMemorySavedRepository implements SavedRepository {
  private all: SavedRecord[] = [];

  async add(ownerId: string, professionalId: string, now = new Date()): Promise<void> {
    if (!this.all.some((r) => r.ownerId === ownerId && r.professionalId === professionalId)) this.all.push({ ownerId, professionalId, savedAt: now });
  }

  async remove(ownerId: string, professionalId: string): Promise<void> {
    this.all = this.all.filter((r) => !(r.ownerId === ownerId && r.professionalId === professionalId));
  }

  async listForOwner(ownerId: string): Promise<string[]> {
    return this.all.filter((r) => r.ownerId === ownerId).map((r) => r.professionalId).reverse();
  }

  async deleteForOwner(ownerId: string): Promise<void> {
    this.all = this.all.filter((r) => r.ownerId !== ownerId);
  }

  async deleteForProfessional(professionalId: string): Promise<void> {
    this.all = this.all.filter((r) => r.professionalId !== professionalId);
  }
}

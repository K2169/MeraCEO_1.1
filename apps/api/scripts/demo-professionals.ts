// Dev helper: adds (or removes) a few approved demo professionals so owners can see matches
// before real professionals exist. Demo accounts are marked demo: true and use example.invalid emails.
//   pnpm demo:add               adds them
//   pnpm demo:request <proId>   adds a demo owner who sends that professional a request
//   pnpm demo:remove            removes all demo people and their needs and requests
import { randomUUID } from 'node:crypto';

import { MongoClient } from 'mongodb';

import { loadConfig } from '../src/config.js';

const DEMOS = [
  { name: 'Ravi Menon', city: 'Bengaluru', state: 'Karnataka', headline: 'Helps shops grow online', expertise: ['marketing', 'sales'], industry: 'retail', feeBand: 'low', formats: ['online', 'phone'] },
  { name: 'Meera Iyer', city: 'Mumbai', state: 'Maharashtra', headline: 'Finance and cash flow for small firms', expertise: ['finance', 'strategy'], industry: 'manufacturing', feeBand: 'mid', formats: ['online', 'in_person'] },
  { name: 'Arjun Kapoor', city: 'Delhi', state: 'Delhi', headline: 'Taking local brands to new countries', expertise: ['international', 'strategy', 'sales'], industry: 'retail', feeBand: 'high', formats: ['online'] },
  { name: 'Sana Qureshi', city: 'Hyderabad', state: 'Telangana', headline: 'Hiring and building strong teams', expertise: ['hr', 'operations'], industry: 'it_services', feeBand: 'low', formats: ['online', 'in_person', 'phone'] },
];

const config = loadConfig();
const mongo = new MongoClient(config.mongo.uri);
await mongo.connect();
const db = mongo.db(config.mongo.db);

if (process.argv[2] === 'request') {
  const professionalId = process.argv[3];
  if (!professionalId) throw new Error('Usage: pnpm demo:request <professionalUserId>');
  const now = new Date();
  const ownerId = randomUUID();
  const needId = randomUUID();
  await db.collection('users').insertOne({
    id: ownerId, googleSub: `demo-owner-${ownerId}`, email: 'demo-owner@example.invalid', name: 'Asha Sharma', role: 'owner',
    ageConfirmed: true, ageConfirmedAt: now, createdAt: now, lastSignInAt: now, demo: true,
  });
  await db.collection('profiles').insertOne({
    userId: ownerId, role: 'owner', moderation: 'approved', available: true, createdAt: now, updatedAt: now,
    data: {
      businessName: 'Sharma Textiles', industry: 'manufacturing', country: 'India', state: 'Gujarat', city: 'Surat', ownerName: 'Asha Sharma',
      needTitle: 'Streamline our production floor', challenge: 'Orders are late because our production steps are not planned well.',
      needExpertise: ['operations'], budgetBand: 'low',
    },
  });
  await db.collection('needs').insertOne({
    id: needId, ownerId, status: 'open', createdAt: now, title: 'Streamline our production floor',
    challenge: 'Orders are late because our production steps are not planned well.', expertise: ['operations'], industry: 'manufacturing', budgetBand: 'low', format: 'online',
  });
  await db.collection('requests').insertOne({
    id: randomUUID(), needId, ownerId, professionalId, note: 'We would love your help this month.', status: 'pending', createdAt: now, updatedAt: now,
  });
  // The same notification the API creates when a request is sent.
  await db.collection('notifications').insertOne({
    id: randomUUID(), userId: professionalId, type: 'request_received', requestId: 'demo', actorName: 'Asha Sharma',
    needTitle: 'Streamline our production floor', createdAt: now, readAt: null,
  });
  console.log('Added a demo owner, a pending request and its notification.');
} else if (process.argv[2] === 'remove') {
  const demoUsers = await db.collection('users').find({ demo: true }).project({ id: 1 }).toArray();
  const ids = demoUsers.map((u) => u.id as string);
  await db.collection('notifications').deleteMany({ requestId: 'demo' });
  await db.collection('requests').deleteMany({ ownerId: { $in: ids } });
  await db.collection('needs').deleteMany({ ownerId: { $in: ids } });
  await db.collection('profiles').deleteMany({ userId: { $in: ids } });
  const removed = await db.collection('users').deleteMany({ demo: true });
  console.log(`Removed ${removed.deletedCount} demo professionals.`);
} else {
  const now = new Date();
  for (const [i, d] of DEMOS.entries()) {
    const id = randomUUID();
    await db.collection('users').insertOne({
      id, googleSub: `demo-${i}-${id}`, email: `demo-${i}@example.invalid`, name: d.name, role: 'professional',
      ageConfirmed: true, ageConfirmedAt: now, createdAt: now, lastSignInAt: now, demo: true,
    });
    await db.collection('profiles').insertOne({
      userId: id, role: 'professional', moderation: 'approved', available: true, createdAt: now, updatedAt: now,
      data: {
        name: d.name, country: 'India', state: d.state, city: d.city, headline: d.headline,
        experience: 'Demo profile used for testing matches.', expertise: d.expertise, industry: d.industry,
        feeBand: d.feeBand, formats: d.formats, disclaimerAccepted: true, termsAccepted: true,
      },
    });
  }
  console.log(`Added ${DEMOS.length} demo professionals.`);
}
await mongo.close();

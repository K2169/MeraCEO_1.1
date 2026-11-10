// Review tool for professional profiles (PRD section 06). Until there is an admin screen, a person
// with access to the database runs this to approve or hide professionals.
//   pnpm pros list               shows every professional with their review status
//   pnpm pros approve <userId>   lets owners see and match with them
//   pnpm pros hide <userId>      removes them from matching
import { MongoClient } from 'mongodb';

import { loadConfig } from '../src/config.js';

const [command, userId] = process.argv.slice(2);
const config = loadConfig();
const mongo = new MongoClient(config.mongo.uri);
await mongo.connect();
const profiles = mongo.db(config.mongo.db).collection('profiles');

if (command === 'list') {
  const rows = await profiles.find({ role: 'professional' }).sort({ createdAt: 1 }).toArray();
  if (rows.length === 0) console.log('No professionals yet.');
  for (const row of rows) {
    const data = row.data as { name: string; headline: string; city: string };
    console.log(`${row.moderation.padEnd(14)} ${row.userId}  ${data.name} - ${data.headline} (${data.city})`);
  }
} else if ((command === 'approve' || command === 'hide') && userId) {
  const moderation = command === 'approve' ? 'approved' : 'hidden';
  const result = await profiles.updateOne({ userId, role: 'professional' }, { $set: { moderation, updatedAt: new Date() } });
  console.log(result.matchedCount === 1 ? `Set ${userId} to ${moderation}.` : 'No professional profile found with that id.');
} else {
  console.log('Usage: pnpm pros list | approve <userId> | hide <userId>');
}
await mongo.close();

import { MongoClient } from 'mongodb';

import { buildApp } from './app.js';
import { createGoogleVerifier } from './auth/google.js';
import { loadConfig } from './config.js';
import { createS3Client } from './storage/presign.js';
import { S3Storage } from './storage/storage.js';
import { MongoConsentRepository } from './consent/repository.js';
import { MongoNotificationRepository } from './notifications/repository.js';
import { MongoSavedRepository } from './saved/repository.js';
import { MongoRequestRepository } from './requests/repository.js';
import { MongoNeedRepository } from './needs/repository.js';
import { MongoProfileRepository } from './profiles/repository.js';
import { MongoUserRepository } from './users/repository.js';

const config = loadConfig();
const mongo = new MongoClient(config.mongo.uri);
await mongo.connect();

const db = mongo.db(config.mongo.db);
const users = new MongoUserRepository(db);
await users.ensureIndexes();
const consents = new MongoConsentRepository(db);
const profiles = new MongoProfileRepository(db);
await profiles.ensureIndexes();
const needs = new MongoNeedRepository(db);
await needs.ensureIndexes();
const requests = new MongoRequestRepository(db);
await requests.ensureIndexes();
const notifications = new MongoNotificationRepository(db);
await notifications.ensureIndexes();
const saved = new MongoSavedRepository(db);
await saved.ensureIndexes();

const app = buildApp({
  sessionSecret: config.sessionSecret,
  verifyGoogle: createGoogleVerifier(config.googleAudiences),
  users,
  consents,
  profiles,
  needs,
  requests,
  notifications,
  saved,
  storage: new S3Storage(createS3Client(config.s3), config.s3.bucket),
});

// Bind to all interfaces so the Android emulator can reach the host through 10.0.2.2.
await app.listen({ port: config.port, host: '0.0.0.0' });

const shutdown = async () => {
  await app.close();
  await mongo.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

import { z } from 'zod';

// All server secrets are read here and nowhere else. Never log this object.
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().startsWith('mongodb'),
  MONGODB_DB: z.string().min(1).default('meraceo_dev'),
  SESSION_JWT_SECRET: z.string().min(32, 'SESSION_JWT_SECRET must be at least 32 characters'),
  GOOGLE_WEB_CLIENT_ID: z.string().endsWith('.apps.googleusercontent.com'),
  GOOGLE_ANDROID_CLIENT_ID: z.string().endsWith('.apps.googleusercontent.com').optional(),
  GOOGLE_ANDROID_RELEASE_CLIENT_ID: z.string().endsWith('.apps.googleusercontent.com').optional(),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
});

export interface Config {
  port: number;
  mongo: { uri: string; db: string };
  sessionSecret: string;
  googleAudiences: string[];
  s3: { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string };
}

// Reads and checks all server settings from the environment. Stops with a clear message if one is missing.
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    // Name the bad keys only. Never echo values.
    const keys = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${keys}`);
  }
  const e = parsed.data;
  return {
    port: e.PORT,
    mongo: { uri: e.MONGODB_URI, db: e.MONGODB_DB },
    sessionSecret: e.SESSION_JWT_SECRET,
    // Web is the audience for tokens from the app; Android IDs are accepted for completeness.
    googleAudiences: [e.GOOGLE_WEB_CLIENT_ID, e.GOOGLE_ANDROID_CLIENT_ID, e.GOOGLE_ANDROID_RELEASE_CLIENT_ID].filter(
      (id): id is string => Boolean(id),
    ),
    s3: {
      endpoint: e.S3_ENDPOINT,
      region: e.S3_REGION,
      bucket: e.S3_BUCKET,
      accessKeyId: e.S3_ACCESS_KEY_ID,
      secretAccessKey: e.S3_SECRET_ACCESS_KEY,
    },
  };
}

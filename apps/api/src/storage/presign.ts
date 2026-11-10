import { randomUUID } from 'node:crypto';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Upload kinds and the content types each one may use (plan W4-03). Anything else is refused.
export const UPLOAD_KINDS = {
  // A person's profile photo (professionals).
  photo: { folder: 'photos', types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } },
  // A business logo (owners).
  logo: { folder: 'logos', types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } },
  credential: {
    folder: 'credentials',
    types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' },
  },
} as const;

export type UploadKind = keyof typeof UPLOAD_KINDS;

export const PRESIGN_TTL_SECONDS = 300;

// Creates the S3 client for Backblaze B2 (path-style addressing is required).
export function createS3Client(s3: {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}): S3Client {
  return new S3Client({
    endpoint: s3.endpoint,
    region: s3.region,
    // Backblaze B2 needs path-style addressing (bucket in the path, not the hostname).
    forcePathStyle: true,
    credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
  });
}

export interface PresignRequest {
  userId: string;
  kind: UploadKind;
  contentType: string;
}

export interface PresignResult {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

// Returns null when the kind or content type is not allowed.
export function buildUploadKey(req: PresignRequest, uuid: string = randomUUID()): string | null {
  const config = UPLOAD_KINDS[req.kind];
  const ext = (config.types as Record<string, string>)[req.contentType];
  if (!ext) return null;
  // Every key starts with the owner's id, so a user can only write inside their own folder.
  return `${req.userId}/${config.folder}/${uuid}.${ext}`;
}

// Creates a short-lived (5 minute) link the app can upload a file to directly.
export async function createUploadUrl(
  client: S3Client,
  bucket: string,
  req: PresignRequest,
  uuid?: string,
): Promise<PresignResult | null> {
  const key = buildUploadKey(req, uuid);
  if (!key) return null;
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: req.contentType });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGN_TTL_SECONDS });
  return { uploadUrl, key, expiresIn: PRESIGN_TTL_SECONDS };
}

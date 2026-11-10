import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { createUploadUrl, type PresignRequest, type PresignResult } from './presign.js';

// How long a link to view a stored file stays valid.
export const READ_URL_SECONDS = 3600;

// Everything the API needs from file storage, in one place so tests can swap in a fake.
export interface Storage {
  // A short-lived link the app uploads to directly. Null when the kind or file type is not allowed.
  createUploadUrl(req: PresignRequest): Promise<PresignResult | null>;
  // A short-lived link for viewing one stored file.
  readUrl(key: string): Promise<string>;
  // Deletes one file.
  remove(key: string): Promise<void>;
  // Deletes every file whose key starts with the prefix (used when an account is deleted).
  removePrefix(prefix: string): Promise<void>;
}

// Backblaze B2 (S3-compatible) storage.
export class S3Storage implements Storage {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  createUploadUrl(req: PresignRequest): Promise<PresignResult | null> {
    return createUploadUrl(this.client, this.bucket, req);
  }

  readUrl(key: string): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: READ_URL_SECONDS });
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async removePrefix(prefix: string): Promise<void> {
    let token: string | undefined;
    do {
      const page = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }));
      const keys = (page.Contents ?? []).map((o) => ({ Key: o.Key! }));
      if (keys.length > 0) await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys } }));
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }
}

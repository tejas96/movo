import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Env } from '../../config/env';

/**
 * Where photo bytes live. Keys look like "<societyId>/<uuid>.jpg" or "avatars/<uuid>.jpg".
 * The database row (StoredFile) is the index; the store only holds bytes.
 */
export abstract class FileStore {
  abstract put(key: string, body: Buffer, mime: string): Promise<void>;
  /** null when the key is not there. */
  abstract get(key: string): Promise<Buffer | null>;
  abstract has(key: string): Promise<boolean>;
  /** No error when the key is already gone. */
  abstract remove(key: string): Promise<void>;
}

/** The server's own disk. Tests and CI use it; production used it before the bucket. */
export class DiskFileStore extends FileStore {
  private readonly root: string;

  constructor(dir: string) {
    super();
    this.root = resolve(dir);
  }

  async put(key: string, body: Buffer): Promise<void> {
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(this.pathOf(key));
    } catch {
      return null;
    }
  }

  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }

  private pathOf(key: string): string {
    const path = resolve(join(this.root, key));
    if (!path.startsWith(this.root)) throw new Error('Bad storage key');
    return path;
  }
}

/**
 * Any S3-compatible bucket: rustfs on a laptop, Oracle Object Storage in production. Nothing
 * here talks to AWS; the endpoint decides where the bytes go.
 */
export class S3FileStore extends FileStore {
  readonly client: S3Client;

  constructor(
    readonly bucket: string,
    opts: { endpoint: string; region: string; accessKeyId: string; secretAccessKey: string },
  ) {
    super();
    this.client = new S3Client({
      endpoint: opts.endpoint,
      region: opts.region,
      forcePathStyle: true,
      credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
      // Oracle's S3 API rejects the newer default CRC checksums; send them only when required.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async put(key: string, body: Buffer, mime: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: mime }),
    );
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!res.Body) return null;
      return Buffer.from(await res.Body.transformToByteArray());
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /** For local development only. In production the bucket is made in the Oracle console. */
  async ensureBucket(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return false;
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
    await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    return true;
  }
}

function isNotFound(error: unknown): boolean {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    e?.name === 'NoSuchKey' ||
    e?.name === 'NotFound' ||
    e?.name === 'NoSuchBucket' ||
    e?.$metadata?.httpStatusCode === 404
  );
}

export function diskStore(env: Env): DiskFileStore {
  return new DiskFileStore(env.FILES_DIR);
}

export function s3Store(env: Env): S3FileStore {
  return new S3FileStore(env.S3_BUCKET, {
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  });
}

export function createFileStore(env: Env): FileStore {
  return env.STORAGE_DRIVER === 's3' ? s3Store(env) : diskStore(env);
}

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadEnv } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';
import { diskStore, s3Store } from '../modules/files/file-store';

const log = (msg: string) => process.stdout.write(`${msg}\n`);

/**
 * Photo store chores. Reads the S3_* settings even when STORAGE_DRIVER is still "disk".
 *
 *   node dist/cli/files.js bucket       make S3_BUCKET if it is missing (local rustfs only)
 *   node dist/cli/files.js copy-to-s3   copy every photo from FILES_DIR to the bucket, then check
 *
 * copy-to-s3 is safe to run again: it skips objects the bucket already has and never deletes.
 */
async function main(): Promise<void> {
  const cmd = process.argv[2];
  const env = loadEnv();
  if (!env.S3_ENDPOINT || !env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY)
    throw new Error('Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY first');
  const s3 = s3Store(env);

  if (cmd === 'bucket') {
    const made = await s3.ensureBucket();
    log(made ? `made bucket ${env.S3_BUCKET}` : `bucket ${env.S3_BUCKET} is already there`);
    return;
  }

  if (cmd === 'copy-to-s3') {
    const disk = diskStore(env);
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    });
    try {
      const rows = await prisma.storedFile.findMany({
        select: { storageKey: true, mime: true },
        orderBy: { createdAt: 'asc' },
      });
      let copied = 0;
      let present = 0;
      const missing: string[] = [];
      for (const row of rows) {
        if (await s3.has(row.storageKey)) {
          present++;
          continue;
        }
        const body = await disk.get(row.storageKey);
        if (!body) {
          missing.push(row.storageKey);
          continue;
        }
        await s3.put(row.storageKey, body, row.mime);
        copied++;
      }
      let inBucket = 0;
      for (const row of rows) if (await s3.has(row.storageKey)) inBucket++;
      log(
        `photos in the database: ${rows.length}; copied now: ${copied}; already in the bucket: ${present}; ` +
          `not on disk: ${missing.length}; in the bucket after: ${inBucket}`,
      );
      for (const key of missing) log(`  not on disk: ${key}`);
      if (inBucket + missing.length !== rows.length) process.exitCode = 1;
    } finally {
      await prisma.$disconnect();
    }
    return;
  }

  log('usage: files.js bucket | copy-to-s3');
  process.exitCode = 2;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

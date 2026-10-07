import { z } from 'zod';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    APP_BASE_URL: z.string().default('movo://'),
    RESEND_API_KEY: z.string().optional().default(''),
    EMAIL_FROM: z.string().default('MOVO <no-reply@example.com>'),
    PLATFORM_ADMIN_EMAIL: z.string().optional().default(''),
    PLATFORM_ADMIN_PASSWORD: z.string().optional().default(''),
    FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional().default(''),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    MIN_SUPPORTED_APP_VERSION: z.string().default('0.1.0'),
    LATEST_APP_VERSION: z.string().default('0.1.0'),
    SUPPORT_EMAIL: z.string().optional().default(''),
    PRIVACY_POLICY_URL: z.string().optional().default(''),
    /** Where photos live: "disk" = FILES_DIR, "s3" = an S3-compatible bucket (rustfs, Oracle). */
    STORAGE_DRIVER: z.enum(['disk', 's3']).default('disk'),
    /** Photo folder for the disk driver, and the source of `files copy-to-s3`. */
    FILES_DIR: z.string().default('./data/files'),
    /** S3 driver. Oracle: https://<namespace>.compat.objectstorage.<region>.oraclecloud.com */
    S3_ENDPOINT: z.string().optional().default(''),
    S3_REGION: z.string().default('us-east-1'),
    S3_BUCKET: z.string().optional().default(''),
    S3_ACCESS_KEY_ID: z.string().optional().default(''),
    S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
    /** healthchecks.io ping URL, pinged every 5 minutes while the API and database are up. Empty = off. */
    UPTIME_HEARTBEAT_URL: z.string().optional().default(''),
  })
  .superRefine((env, ctx) => {
    if (env.STORAGE_DRIVER !== 's3') return;
    for (const key of [
      'S3_ENDPOINT',
      'S3_BUCKET',
      'S3_ACCESS_KEY_ID',
      'S3_SECRET_ACCESS_KEY',
    ] as const)
      if (!env[key])
        ctx.addIssue({ code: 'custom', path: [key], message: 'required when STORAGE_DRIVER=s3' });
  });

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Validated once. A missing or malformed variable stops the process at boot with a clear message. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${lines}`);
  }
  cached = parsed.data;
  return cached;
}

export function resetEnvForTests(): void {
  cached = undefined;
}

import { z } from 'zod';

const EnvSchema = z.object({
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
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  MIN_SUPPORTED_APP_VERSION: z.string().default('0.1.0'),
  LATEST_APP_VERSION: z.string().default('0.1.0'),
  SUPPORT_EMAIL: z.string().optional().default(''),
  PRIVACY_POLICY_URL: z.string().optional().default(''),
  /** Uploaded photos live here. A Docker volume in production. */
  FILES_DIR: z.string().default('./data/files'),
  /** healthchecks.io ping URL, pinged every 5 minutes while the API and database are up. Empty = off. */
  UPTIME_HEARTBEAT_URL: z.string().optional().default(''),
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

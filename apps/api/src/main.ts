import 'dotenv/config';
import { createApp } from './app';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await createApp();
  await app.listen(env.API_PORT, '0.0.0.0');
  // biome-ignore lint/suspicious/noConsole: boot banner
  console.log(`MOVO API listening on http://0.0.0.0:${env.API_PORT} (${env.NODE_ENV})`);
}

void bootstrap();

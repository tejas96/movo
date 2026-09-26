import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { requestStoreMiddleware } from './common/request-store';

/** The one boot path, shared by main.ts and the test suite. */
export async function createApp(): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: true,
  });
  app.useLogger(app.get(Logger));
  app.set('trust proxy', 1);
  app.use(requestStoreMiddleware);
  app.enableCors({ origin: true, credentials: false });
  app.enableShutdownHooks();
  return app;
}

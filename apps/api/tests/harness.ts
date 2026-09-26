import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/app';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { runWithStore } from '../src/common/request-store';
import { newId } from '../src/common/util/ids';
import { PasswordService } from '../src/modules/identity/password.service';

export interface Harness {
  app: INestApplication;
  prisma: PrismaService;
  http: () => request.Agent;
  close: () => Promise<void>;
  reset: () => Promise<void>;
  makePlatformAdmin: () => Promise<{ token: string; userId: string }>;
  register: (
    identifier: string,
    displayName?: string,
  ) => Promise<{ token: string; refreshToken: string; userId: string }>;
  createSociety: (
    adminToken: string,
    name: string,
    adminIdentifier: string,
  ) => Promise<{ societyId: string; joinCode: string; adminMembershipId: string }>;
}

const PASSWORD = 'correct horse battery';

export async function createHarness(): Promise<Harness> {
  const app = await createApp();
  await app.init();
  const prisma = app.get(PrismaService);
  const passwords = app.get(PasswordService);
  const http = () => request(app.getHttpServer());

  const reset = async () => {
    const tables = await prisma.$queryRaw<
      { tablename: string }[]
    >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
    const names = tables.map((t) => `"${t.tablename}"`).join(', ');
    if (names) await prisma.$executeRawUnsafe(`TRUNCATE ${names} CASCADE`);
  };

  const register = async (identifier: string, displayName = 'Test User') => {
    const res = await http()
      .post('/v1/auth/register')
      .send({ identifier, password: PASSWORD, displayName, locale: 'en' });
    if (res.status !== 201)
      throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
    return {
      token: res.body.tokens.accessToken as string,
      refreshToken: res.body.tokens.refreshToken as string,
      userId: res.body.user.id as string,
    };
  };

  const makePlatformAdmin = async () => {
    const email = `platform-${newId().slice(-12)}@movo.test`;
    const user = await prisma.user.create({
      data: {
        email,
        displayName: 'Platform',
        credentials: { create: { type: 'PASSWORD', secretHash: await passwords.hash(PASSWORD) } },
        platformAdmin: { create: {} },
      },
    });
    const res = await http().post('/v1/auth/login').send({ identifier: email, password: PASSWORD });
    return { token: res.body.tokens.accessToken as string, userId: user.id };
  };

  const createSociety = async (adminToken: string, name: string, adminIdentifier: string) => {
    const res = await http()
      .post('/v1/platform/societies')
      .set('authorization', `Bearer ${adminToken}`)
      .send({
        name,
        admin: { identifier: adminIdentifier, displayName: 'Society Admin', password: PASSWORD },
      });
    if (res.status !== 201)
      throw new Error(`createSociety failed: ${res.status} ${JSON.stringify(res.body)}`);
    return {
      societyId: res.body.society.id as string,
      joinCode: res.body.joinCode as string,
      adminMembershipId: res.body.adminMembershipId as string,
    };
  };

  return {
    app,
    prisma,
    http,
    reset,
    register,
    makePlatformAdmin,
    createSociety,
    close: () => app.close(),
  };
}

export const TEST_PASSWORD = PASSWORD;

export async function login(h: Harness, identifier: string): Promise<string> {
  const res = await h.http().post('/v1/auth/login').send({ identifier, password: PASSWORD });
  if (res.status !== 201)
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.tokens.accessToken as string;
}

export function withStore<T>(fn: () => Promise<T>): Promise<T> {
  return runWithStore({ requestId: newId(), ip: undefined }, fn);
}

import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../common/prisma/prisma.service';
import { runWithStore } from '../common/request-store';
import { newId } from '../common/util/ids';
import { loadEnv } from '../config/env';
import { PasswordService } from '../modules/identity/password.service';
import { UsersService } from '../modules/identity/users.service';
import { SocietiesService } from '../modules/tenancy/societies.service';

/**
 * pnpm seed          -> ensures the platform admin from .env exists
 * pnpm seed --demo   -> also creates "Sunrise Residency" with two wings, flats and an invite code
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const passwords = app.get(PasswordService);
  const users = app.get(UsersService);
  const societies = app.get(SocietiesService);
  const log = (msg: string) => process.stdout.write(`${msg}\n`);

  await runWithStore({ requestId: newId(), ip: undefined }, async () => {
    if (env.PLATFORM_ADMIN_EMAIL && env.PLATFORM_ADMIN_PASSWORD) {
      const id = users.parseIdentifier(env.PLATFORM_ADMIN_EMAIL);
      if (!id) throw new Error('PLATFORM_ADMIN_EMAIL is not a valid email or phone');
      let admin = await users.findByIdentifier(id);
      if (!admin) {
        admin = await prisma.user.create({
          data: {
            email: id.kind === 'email' ? id.value : null,
            phone: id.kind === 'phone' ? id.value : null,
            displayName: 'MOVO Platform Admin',
            credentials: {
              create: {
                type: 'PASSWORD',
                secretHash: await passwords.hash(env.PLATFORM_ADMIN_PASSWORD),
              },
            },
          },
        });
        log(`created platform admin user ${id.value}`);
      }
      await prisma.platformAdmin.upsert({
        where: { userId: admin.id },
        update: {},
        create: { userId: admin.id },
      });
      log(`platform admin ready: ${id.value}`);
    } else {
      log('PLATFORM_ADMIN_EMAIL/PASSWORD not set, skipping platform admin');
    }

    if (process.argv.includes('--demo')) {
      const existing = await prisma.society.findUnique({ where: { slug: 'sunrise-residency' } });
      if (existing) {
        log(`demo society exists: joinCode=${existing.joinCode}`);
      } else {
        const result = await societies.create({
          name: 'Sunrise Residency',
          slug: 'sunrise-residency',
          city: 'Pune',
          state: 'Maharashtra',
          defaultLocale: 'en',
          timezone: 'Asia/Kolkata',
          fyStartMonth: 4,
          admin: {
            identifier: '+919999900001',
            displayName: 'Anita Sharma',
            password: 'demo-admin-1',
          },
        });
        const societyId = result.society.id;
        const wingA = await prisma.building.create({
          data: { societyId, name: 'A', floorsCount: 4, sortOrder: 0 },
        });
        const wingB = await prisma.building.create({
          data: { societyId, name: 'B', floorsCount: 4, sortOrder: 1 },
        });
        const numbers = [
          '101',
          '102',
          '103',
          '104',
          '201',
          '202',
          '203',
          '204',
          '301',
          '302',
          '303',
          '304',
        ];
        await prisma.flat.createMany({
          data: [
            ...numbers.map((n) => ({
              societyId,
              buildingId: wingA.id,
              number: n,
              floor: Number(n[0]),
            })),
            ...numbers.map((n) => ({
              societyId,
              buildingId: wingB.id,
              number: n,
              floor: Number(n[0]),
            })),
          ],
        });
        const flatA101 = await prisma.flat.findFirstOrThrow({
          where: { societyId, buildingId: wingA.id, number: '101' },
        });
        const flatA102 = await prisma.flat.findFirstOrThrow({
          where: { societyId, buildingId: wingA.id, number: '102' },
        });
        await prisma.flatOccupancy.create({
          data: {
            societyId,
            flatId: flatA101.id,
            membershipId: result.adminMembershipId,
            relation: 'OWNER',
            isPrimaryContact: true,
          },
        });
        await prisma.flat.update({ where: { id: flatA101.id }, data: { status: 'OCCUPIED' } });
        const residentRole = await prisma.role.findFirstOrThrow({
          where: { societyId, key: 'resident' },
        });
        await prisma.invitation.create({
          data: {
            societyId,
            code: 'DEMO1234',
            inviteeName: 'Tejas Patil',
            flatId: flatA102.id,
            roleId: residentRole.id,
            relation: 'OWNER',
            invitedByMembershipId: result.adminMembershipId,
            expiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000),
          },
        });
        log('demo society created: Sunrise Residency (Pune), wings A and B, 24 flats');
        log(`  admin login: +919999900001 / demo-admin-1`);
        log(`  society join code: ${result.joinCode}`);
        log('  invite code for flat A-102: DEMO1234');
      }
    }
  });
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../common/prisma/prisma.service';
import { runWithStore } from '../common/request-store';
import { newId } from '../common/util/ids';
import { loadEnv } from '../config/env';
import { defaultEmergencyContactRows } from '../modules/emergency/emergency.service';
import { PasswordService } from '../modules/identity/password.service';
import { UsersService } from '../modules/identity/users.service';
import { SocietiesService } from '../modules/tenancy/societies.service';
import { defaultVendorCategoryRows } from '../modules/vendors/vendors.service';

/** Services, emergency contacts and parking for the demo society. Safe to run again. */
async function ensureM4Demo(
  prisma: PrismaService,
  societyId: string,
  log: (msg: string) => void,
): Promise<void> {
  const admin = await prisma.membership.findFirst({
    where: { societyId, roles: { some: { role: { key: 'admin' } } } },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) return;
  const flatA101 = await prisma.flat.findFirst({
    where: { societyId, number: '101', building: { name: 'A' } },
  });

  if ((await prisma.vendorCategory.count({ where: { societyId } })) === 0)
    await prisma.vendorCategory.createMany({ data: defaultVendorCategoryRows(societyId) });
  if ((await prisma.vendor.count({ where: { societyId } })) === 0) {
    const cat = async (key: string) =>
      (await prisma.vendorCategory.findFirstOrThrow({ where: { societyId, key } })).id;
    const vendors = [
      ['plumber', 'Ramesh Plumbing Works', '+919800000101', '9 AM to 7 PM, Sunday off', 'APPROVED'],
      [
        'plumber',
        'Quick Fix Plumbers',
        '+919800000102',
        'Any time, extra charge at night',
        'TRIAL',
      ],
      ['electrician', 'Sai Electricals', '+919800000103', '10 AM to 8 PM', 'APPROVED'],
      ['carpenter', 'Mahesh Furniture Repair', '+919800000104', 'Weekdays', 'APPROVED'],
      ['waterTanker', 'Shree Water Supply', '+919800000105', '6 AM to 10 PM', 'APPROVED'],
      ['pestControl', 'Green Shield Pest Control', '+919800000106', 'By appointment', 'APPROVED'],
    ] as const;
    for (const [key, name, phone, availability, status] of vendors) {
      await prisma.vendor.create({
        data: {
          societyId,
          categoryId: await cat(key),
          name,
          phone,
          availability,
          status,
          addedByMembershipId: admin.id,
        },
      });
    }
  }

  // New societies already get the public numbers, so check each group on its own.
  if ((await prisma.emergencyContact.count({ where: { societyId, isPublicNumber: true } })) === 0)
    await prisma.emergencyContact.createMany({ data: defaultEmergencyContactRows(societyId) });
  if (
    (await prisma.emergencyContact.count({ where: { societyId, isPublicNumber: false } })) === 0
  ) {
    await prisma.emergencyContact.createMany({
      data: [
        {
          societyId,
          label: 'Main gate security',
          phone: '+919800000201',
          type: 'SECURITY',
          sortOrder: 0,
        },
        { societyId, label: 'Lift AMC (Otis)', phone: '+919800000202', type: 'LIFT', sortOrder: 1 },
        {
          societyId,
          label: 'Society office',
          phone: '+919800000203',
          type: 'ADMIN',
          sortOrder: 2,
        },
      ],
    });
  }

  if ((await prisma.parkingSlot.count({ where: { societyId } })) === 0) {
    const pad = (n: number) => String(n).padStart(2, '0');
    await prisma.parkingSlot.createMany({
      data: [
        ...Array.from({ length: 20 }, (_, i) => ({
          societyId,
          code: `P-${pad(i + 1)}`,
          type: 'FOUR_WHEELER' as const,
          level: 'Stilt',
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          societyId,
          code: `T-${pad(i + 1)}`,
          type: 'TWO_WHEELER' as const,
          level: 'Stilt',
        })),
        { societyId, code: 'V-01', type: 'FOUR_WHEELER' as const, status: 'VISITOR' as const },
      ],
    });
    if (flatA101) {
      const slot = await prisma.parkingSlot.findFirstOrThrow({
        where: { societyId, code: 'P-01' },
      });
      await prisma.parkingAllocation.create({
        data: {
          societyId,
          slotId: slot.id,
          flatId: flatA101.id,
          allocatedByMembershipId: admin.id,
        },
      });
      await prisma.vehicle.create({
        data: {
          societyId,
          flatId: flatA101.id,
          registrationNo: 'MH12AB1234',
          type: 'FOUR_WHEELER',
          makeModel: 'Maruti Swift',
          color: 'White',
        },
      });
    }
  }
  log('demo services, emergency contacts and parking ready');
}

/**
 * pnpm seed          -> ensures the platform admin from .env exists
 * pnpm seed --demo   -> also creates "Sunrise Residency" with two wings, flats and an invite code
 */
/** Evening in India, n days from today. */
function istEvening(daysAhead: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(hour - 5, minute - 30, 0, 0);
  return d;
}

/** One meeting and one event for the demo society. Safe to run again. */
async function ensureM5Demo(
  prisma: PrismaService,
  societyId: string,
  log: (msg: string) => void,
): Promise<void> {
  const admin = await prisma.membership.findFirst({
    where: { societyId, roles: { some: { role: { key: 'admin' } } } },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) return;
  if ((await prisma.meeting.count({ where: { societyId } })) === 0) {
    await prisma.meeting.create({
      data: {
        societyId,
        title: 'Monthly committee meeting',
        agenda: '1. Water tank cleaning schedule\n2. Parking stickers\n3. Diwali plans',
        location: 'Clubhouse',
        startsAt: istEvening(5, 19),
        endsAt: istEvening(5, 20),
        audience: { type: 'ALL' },
        createdByMembershipId: admin.id,
      },
    });
    log('added a demo meeting');
  }
  if ((await prisma.societyEvent.count({ where: { societyId } })) === 0) {
    await prisma.societyEvent.create({
      data: {
        societyId,
        title: 'Navratri garba night',
        description: 'Garba and dandiya in the garden. Snacks from the committee.',
        location: 'Society garden',
        startsAt: istEvening(10, 19, 30),
        endsAt: istEvening(10, 22, 30),
        audience: { type: 'ALL' },
        createdByMembershipId: admin.id,
      },
    });
    log('added a demo event');
  }
}

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
        await ensureM4Demo(prisma, existing.id, log);
        await ensureM5Demo(prisma, existing.id, log);
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
        await ensureM4Demo(prisma, societyId, log);
        await ensureM5Demo(prisma, societyId, log);
      }
    }
  });
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

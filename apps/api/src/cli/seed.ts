import 'dotenv/config';
import 'reflect-metadata';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../common/prisma/prisma.service';
import { runWithStore } from '../common/request-store';
import { newId } from '../common/util/ids';
import { loadEnv } from '../config/env';
import { DutiesService } from '../modules/duties/duties.service';
import { defaultEmergencyContactRows } from '../modules/emergency/emergency.service';
import { defaultExpenseCategoryRows } from '../modules/expenses/expenses.service';
import { PasswordService } from '../modules/identity/password.service';
import { UsersService } from '../modules/identity/users.service';
import { fyLabel, receiptNo, todayIn } from '../modules/maintenance/billing';
import { BillsService } from '../modules/maintenance/bills.service';
import { dbDate, refreshBills } from '../modules/maintenance/ledger';
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

/** A monthly plan, a UPI id, this month's bills and a few paid flats. Safe to run again. */
async function ensureM6Demo(
  app: INestApplicationContext,
  prisma: PrismaService,
  societyId: string,
  log: (msg: string) => void,
): Promise<void> {
  const admin = await prisma.membership.findFirst({
    where: { societyId, roles: { some: { role: { key: 'admin' } } } },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) return;
  if ((await prisma.paymentInstruction.count({ where: { societyId } })) === 0) {
    await prisma.paymentInstruction.create({
      data: {
        societyId,
        kind: 'UPI',
        label: 'Society UPI',
        value: 'sunriseresidency@okaxis',
        payeeName: 'Sunrise Residency CHS',
      },
    });
  }
  if ((await prisma.billingPlan.count({ where: { societyId } })) > 0) return;
  const today = todayIn('Asia/Kolkata');
  await prisma.billingPlan.create({
    data: {
      societyId,
      name: 'Maintenance',
      frequency: 'MONTHLY',
      amountRule: 'FLAT_RATE',
      amountPaise: 250_000,
      dueDay: 10,
      generateDaysBefore: 7,
      lateFee: { type: 'FIXED', amountPaise: 10_000, graceDays: 5 },
      activeFrom: dbDate(`${today.slice(0, 7)}-01`),
    },
  });
  const { created } = await app.get(BillsService).generateForSociety(societyId, new Date());
  // Most flats have paid, so the collection view has a mix. A-101 (the admin) still owes.
  const paid = await prisma.bill.findMany({
    where: { societyId, flat: { NOT: { number: '101', building: { name: 'A' } } } },
    orderBy: [{ flat: { building: { name: 'asc' } } }, { flat: { number: 'asc' } }],
    take: 16,
  });
  const fy = fyLabel(today, 4);
  let n = 0;
  await prisma.$transaction(async (tx) => {
    for (const b of paid) {
      n += 1;
      await tx.payment.create({
        data: {
          societyId,
          flatId: b.flatId,
          amountPaise: b.totalPaise,
          paidOn: dbDate(today),
          method: n % 3 === 0 ? 'CASH' : 'UPI',
          receiptNo: receiptNo(fy, n),
          financialYear: fy,
          recordedByMembershipId: admin.id,
          idempotencyKey: `seed-${b.id}`,
          allocations: { create: { societyId, billId: b.id, amountPaise: b.totalPaise } },
        },
      });
    }
    await tx.receiptCounter.create({ data: { societyId, financialYear: fy, lastNo: n } });
    await refreshBills(
      tx,
      paid.map((b) => b.id),
      today,
    );
  });
  log(`added a billing plan, ${created} bills and ${n} payments`);
}

/** Expense categories, this month's spending and one hall booking. Safe to run again. */
async function ensureM7Demo(
  prisma: PrismaService,
  societyId: string,
  log: (msg: string) => void,
): Promise<void> {
  const admin = await prisma.membership.findFirst({
    where: { societyId, roles: { some: { role: { key: 'admin' } } } },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) return;
  if ((await prisma.expenseCategory.count({ where: { societyId } })) === 0)
    await prisma.expenseCategory.createMany({ data: defaultExpenseCategoryRows(societyId) });
  if ((await prisma.expense.count({ where: { societyId } })) > 0) return;
  const today = todayIn('Asia/Kolkata');
  const month = today.slice(0, 7);
  const fy = fyLabel(today, 4);
  const cat = async (key: string) =>
    (await prisma.expenseCategory.findFirstOrThrow({ where: { societyId, key } })).id;
  const rows: [string, number, string, string, string][] = [
    ['electricity', 1_845_000, 'MSEDCL', 'Common area and pumps', '05'],
    ['security', 2_400_000, 'Shield Security Services', 'Two guards, September', '03'],
    ['housekeeping', 1_200_000, 'CleanPro', 'Daily cleaning', '03'],
    ['lift', 450_000, 'Otis Elevators', 'Quarterly service', '12'],
    ['water', 320_000, 'Pune Water Tankers', 'Two tankers', '18'],
  ];
  for (const [key, amountPaise, payeeName, description, dd] of rows) {
    await prisma.expense.create({
      data: {
        societyId,
        categoryId: await cat(key),
        amountPaise,
        // Never in the future, even when the seed runs early in the month.
        incurredOn: dbDate(`${month}-${dd < today.slice(8) ? dd : today.slice(8)}`),
        payeeName,
        description,
        method: 'BANK_TRANSFER',
        status: 'APPROVED',
        financialYear: fy,
        createdByMembershipId: admin.id,
        idempotencyKey: `seed-${key}`,
      },
    });
  }
  await prisma.incomeEntry.create({
    data: {
      societyId,
      kind: 'HALL_BOOKING',
      amountPaise: 300_000,
      receivedOn: dbDate(`${month}-${'08' < today.slice(8) ? '08' : today.slice(8)}`),
      description: 'Clubhouse booking, B-204',
      financialYear: fy,
      createdByMembershipId: admin.id,
    },
  });
  log(`added ${rows.length} expenses and one income entry`);
}

/** A monthly gate-locking rotation, two tasks and some points. Safe to run again. */
async function ensureM8Demo(
  app: INestApplicationContext,
  prisma: PrismaService,
  societyId: string,
  log: (msg: string) => void,
): Promise<void> {
  const admin = await prisma.membership.findFirst({
    where: { societyId, roles: { some: { role: { key: 'admin' } } } },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) return;
  if ((await prisma.responsibility.count({ where: { societyId } })) > 0) return;
  const today = todayIn('Asia/Kolkata');
  const wingA = await prisma.flat.findMany({
    where: { societyId, building: { name: 'A' } },
    orderBy: { number: 'asc' },
  });
  await prisma.responsibility.create({
    data: {
      societyId,
      title: 'Main gate locking',
      description: 'Lock the main gate at 11 pm and open it at 5 am.',
      participantKind: 'FLAT',
      periodUnit: 'MONTH',
      periodLength: 1,
      startDate: dbDate(`${today.slice(0, 7)}-01`),
      requiresConfirmation: true,
      onMiss: 'MARK_MISSED',
      createdByMembershipId: admin.id,
      participants: {
        create: wingA.map((f, position) => ({ societyId, position, flatId: f.id })),
      },
    },
  });
  await app.get(DutiesService).advance(new Date());
  await prisma.task.create({
    data: {
      societyId,
      title: 'Submit water bill at PMC',
      description: 'Take the bill and the cheque to the PMC ward office.',
      points: 3,
      status: 'OPEN',
      createdByMembershipId: admin.id,
      events: { create: { societyId, kind: 'CREATED', byMembershipId: admin.id } },
    },
  });
  const done = await prisma.task.create({
    data: {
      societyId,
      title: 'Plant saplings near gate',
      points: 5,
      status: 'COMPLETED',
      assigneeMembershipId: admin.id,
      completedAt: new Date(),
      createdByMembershipId: admin.id,
      events: { create: { societyId, kind: 'CREATED', byMembershipId: admin.id } },
    },
  });
  await prisma.pointsLedger.create({
    data: {
      societyId,
      membershipId: admin.id,
      delta: 5,
      reason: 'TASK',
      label: done.title,
      refType: 'Task',
      refId: done.id,
      financialYear: fyLabel(today, 4),
    },
  });
  log('added a duty rotation, two tasks and some points');
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
        await ensureM6Demo(app, prisma, existing.id, log);
        await ensureM7Demo(prisma, existing.id, log);
        await ensureM8Demo(app, prisma, existing.id, log);
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
        await ensureM6Demo(app, prisma, societyId, log);
        await ensureM7Demo(prisma, societyId, log);
        await ensureM8Demo(app, prisma, societyId, log);
      }
    }
  });
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

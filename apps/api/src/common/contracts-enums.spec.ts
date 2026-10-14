import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as c from '@movo/contracts';
import { describe, expect, it } from 'vitest';

/**
 * Prisma enums and the zod enums in @movo/contracts are written by hand on both sides.
 * This test keeps them in step: a value added or removed on one side only fails here.
 */

interface EnumLike {
  readonly options: readonly string[];
}

/** Prisma enum -> zod enum with exactly the same values. */
const SAME: Record<string, EnumLike> = {
  Locale: c.LocaleSchema,
  DevicePlatform: c.DevicePlatformSchema,
  MembershipStatus: c.MembershipStatusSchema,
  OccupancyRelation: c.OccupancyRelationSchema,
  FlatStatus: c.FlatStatusSchema,
  InvitationStatus: c.InvitationStatusSchema,
  JoinRequestStatus: c.JoinRequestStatusSchema,
  NoticeCategory: c.NoticeCategorySchema,
  NoticePriority: c.NoticePrioritySchema,
  NoticeStatus: c.NoticeStatusSchema,
  NotificationCategory: c.NotificationCategorySchema,
  ParkingSlotType: c.ParkingSlotTypeSchema,
  ParkingSlotStatus: c.ParkingSlotStatusSchema,
  VehicleType: c.VehicleTypeSchema,
  VendorStatus: c.VendorStatusSchema,
  EmergencyContactType: c.EmergencyContactTypeSchema,
  AlertSource: c.AlertSchema.shape.source,
  AlertType: c.AlertTypeSchema,
  AlertStatus: c.AlertStatusSchema,
  MeetingStatus: c.MeetingStatusSchema,
  MeetingUpdateKind: c.MeetingUpdateKindSchema,
  EventStatus: c.EventStatusSchema,
  RsvpResponse: c.RsvpResponseSchema,
  BillingFrequency: c.BillingFrequencySchema,
  AmountRule: c.AmountRuleSchema,
  BillKind: c.BillKindSchema,
  BillStatus: c.BillStatusSchema,
  BillLineType: c.BillLineTypeSchema,
  PaymentMethod: c.PaymentMethodSchema,
  PaymentStatus: c.PaymentStatusSchema,
  PaymentInstructionKind: c.PaymentInstructionKindSchema,
  ExpenseStatus: c.ExpenseStatusSchema,
  IncomeKind: c.IncomeKindSchema,
  DutyPeriodUnit: c.DutyPeriodUnitSchema,
  DutyParticipantKind: c.DutyParticipantKindSchema,
  DutyStatus: c.DutyStatusSchema,
  DutyOnMiss: c.DutyOnMissSchema,
  AssignmentStatus: c.AssignmentStatusSchema,
  ListingKind: c.ListingKindSchema,
  Diet: c.DietSchema,
  PriceType: c.PriceTypeSchema,
  Fulfilment: c.FulfilmentSchema,
  ItemCondition: c.ItemConditionSchema,
  ListingStatus: c.ListingStatusSchema,
  ListingVisibility: c.ListingVisibilitySchema,
  OrderStatus: c.OrderStatusSchema,
  TaskStatus: c.TaskStatusSchema,
  TaskEventKind: c.TaskEventKindSchema,
  PointsReason: c.PointsReasonSchema,
};

/** Prisma enum -> zod enum that deliberately leaves some values out. */
const SUBSET: Record<string, { schema: EnumLike; leftOut: string[]; reason: string }> = {
  FileKind: {
    schema: c.UploadKindSchema,
    leftOut: ['AVATAR'],
    reason: 'Avatars are not uploaded through the files route.',
  },
};

/** Prisma enums the API never sends or accepts as an enum. */
const DB_ONLY: Record<string, string> = {
  UserStatus: 'Server only: no contract field carries a user status.',
  CredentialType: 'Server only: login methods stay inside auth.',
  ResetKind: 'Server only: reset tokens stay inside auth.',
  SocietyStatus: 'Server only: no contract field carries a society status.',
  DeliveryChannel: 'Server only: notification outbox detail.',
  DeliveryStatus: 'Server only: notification outbox detail.',
  ReportStatus: 'Server only: listing reports are sent without their status.',
};

function prismaEnums(): Map<string, string[]> {
  const schema = readFileSync(resolve(__dirname, '../../prisma/schema.prisma'), 'utf8');
  const enums = new Map<string, string[]>();
  for (const [, name, body] of schema.matchAll(/^enum (\w+) \{([\s\S]*?)^\}/gm)) {
    const values = (body ?? '')
      .split('\n')
      .map((line) => line.replace(/\/\/.*$/, '').trim())
      .filter((line) => line && !line.startsWith('@@'))
      .map((line) => line.split(/\s+/)[0] as string);
    enums.set(name as string, values);
  }
  return enums;
}

const sorted = (values: readonly string[]) => [...values].sort();

describe('Prisma enums vs contract enums', () => {
  const db = prismaEnums();

  it('finds the enums in schema.prisma', () => {
    expect(db.size).toBeGreaterThan(50);
  });

  it('puts every Prisma enum in exactly one list', () => {
    const lists = [SAME, SUBSET, DB_ONLY];
    const unlisted = [...db.keys()].filter((name) => !lists.some((list) => name in list));
    expect(unlisted, 'add these to SAME, SUBSET or DB_ONLY (with a reason)').toEqual([]);
    const twice = [...db.keys()].filter((name) => lists.filter((list) => name in list).length > 1);
    expect(twice).toEqual([]);
  });

  it('names no enum that is gone from schema.prisma', () => {
    const listed = [...Object.keys(SAME), ...Object.keys(SUBSET), ...Object.keys(DB_ONLY)];
    expect(listed.filter((name) => !db.has(name))).toEqual([]);
  });

  it.each(Object.entries(SAME))('%s has the same values in zod', (name, schema) => {
    expect(sorted(schema.options)).toEqual(sorted(db.get(name) ?? []));
  });

  it.each(Object.entries(SUBSET))(
    '%s is the zod enum plus leftOut',
    (name, { schema, leftOut }) => {
      const dbValues = db.get(name) ?? [];
      expect(
        leftOut.filter((v) => !dbValues.includes(v)),
        'leftOut value not in Prisma',
      ).toEqual([]);
      expect(sorted(schema.options)).toEqual(sorted(dbValues.filter((v) => !leftOut.includes(v))));
    },
  );
});

import { z } from 'zod';
import { IdSchema } from '../core/common';
import type { ModuleKey } from '../core/enums';

export const TenancySettingsSchema = z.object({
  joinRequests: z.enum(['OFF', 'APPROVAL']).default('APPROVAL'),
});
export const DirectorySettingsSchema = z.object({
  allowPhoneOptIn: z.boolean().default(true),
  showVehicles: z.enum(['OFF', 'ADMINS', 'ALL']).default('ADMINS'),
  staffVisible: z.boolean().default(false),
});
export const NoticesSettingsSchema = z.object({
  maxPinned: z.number().int().min(1).max(10).default(3),
});
export const MeetingsSettingsSchema = z.object({
  reminderHoursBefore: z.array(z.number().int().min(1).max(168)).max(3).default([24, 1]),
});
export const EventsSettingsSchema = z.object({
  rsvpEnabledByDefault: z.boolean().default(true),
});
export const ParkingSettingsSchema = z.object({
  membersSeeAllAllocations: z.boolean().default(false),
});
export const TasksSettingsSchema = z.object({
  volunteeringEnabled: z.boolean().default(true),
});
export const ResponsibilitiesSettingsSchema = z.object({
  defaultRequiresConfirmation: z.boolean().default(true),
});
export const RewardsSettingsSchema = z.object({
  leaderboard: z.enum(['OFF', 'TOP_5', 'ALL']).default('OFF'),
  dutiesEarnPoints: z.boolean().default(false),
  redemptionEnabled: z.boolean().default(false),
  pointValuePaise: z.number().int().min(0).default(0),
  maxPointsPerMonth: z.number().int().min(0).nullable().default(null),
});
export const MaintenanceSettingsSchema = z.object({
  transparency: z.enum(['OFF', 'STATUS', 'STATUS_AND_AMOUNT']).default('STATUS'),
});
export const ExpensesSettingsSchema = z.object({
  visibleToMembers: z.enum(['NONE', 'SUMMARY', 'DETAILED']).default('SUMMARY'),
  approval: z.enum(['NEVER', 'ABOVE_AMOUNT', 'ALWAYS']).default('ABOVE_AMOUNT'),
  approvalThresholdPaise: z.number().int().min(0).default(500_000),
});
export const VendorsSettingsSchema = z.object({
  membersCanSuggest: z.boolean().default(true),
});
export const EmergencySettingsSchema = z.object({
  alertRecipients: z.enum(['ALL', 'ROLES']).default('ALL'),
  roleIds: z.array(IdSchema).default([]),
  cooldownMinutes: z.number().int().min(1).max(60).default(5),
});
export const MarketplaceSettingsSchema = z.object({
  network: z.boolean().default(false),
  resaleEnabled: z.boolean().default(true),
});

export const moduleSettingsSchemas = {
  notices: NoticesSettingsSchema,
  meetings: MeetingsSettingsSchema,
  events: EventsSettingsSchema,
  directory: DirectorySettingsSchema,
  parking: ParkingSettingsSchema,
  tasks: TasksSettingsSchema,
  responsibilities: ResponsibilitiesSettingsSchema,
  rewards: RewardsSettingsSchema,
  maintenance: MaintenanceSettingsSchema,
  expenses: ExpensesSettingsSchema,
  vendors: VendorsSettingsSchema,
  emergency: EmergencySettingsSchema,
  marketplace: MarketplaceSettingsSchema,
} as const satisfies Record<ModuleKey, z.ZodObject>;

export type ModuleSettings = { [K in ModuleKey]: z.infer<(typeof moduleSettingsSchemas)[K]> };

/** Which modules a new society starts with. Marketplace is off until the society opts in. */
export const DEFAULT_MODULE_ENABLED: Record<ModuleKey, boolean> = {
  notices: true,
  meetings: true,
  events: true,
  directory: true,
  parking: true,
  tasks: true,
  responsibilities: true,
  rewards: true,
  maintenance: true,
  expenses: true,
  vendors: true,
  emergency: true,
  marketplace: false,
};

/** Society-level (core) settings that are not tied to one module. */
export const SocietySettingsSchema = z.object({
  tenancy: TenancySettingsSchema.default(TenancySettingsSchema.parse({})),
});
export type SocietySettings = z.infer<typeof SocietySettingsSchema>;

export function parseModuleSettings<K extends ModuleKey>(key: K, raw: unknown): ModuleSettings[K] {
  return moduleSettingsSchemas[key].parse(raw ?? {}) as ModuleSettings[K];
}

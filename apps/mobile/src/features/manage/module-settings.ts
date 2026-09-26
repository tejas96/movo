import type { ModuleKey, PermissionKey } from '@movo/contracts';
import type { IconName } from '@movo/design-system';

/**
 * What the Modules screen can edit for each module. The API validates every value against the
 * module's settings schema in @movo/contracts, so this list only decides what is shown.
 * Labels live in manage.json under moduleSettings.<module>.<field>.
 */
export type SettingField =
  | { key: string; kind: 'toggle' }
  | { key: string; kind: 'choice'; options: readonly string[] }
  | { key: string; kind: 'number'; min: number; max: number; nullable?: boolean }
  | { key: string; kind: 'rupees' }
  | { key: string; kind: 'hours'; options: readonly number[]; max: number }
  | { key: string; kind: 'roles'; showWhen: { key: string; value: string } };

export const MODULE_SETTINGS: Partial<Record<ModuleKey, readonly SettingField[]>> = {
  notices: [{ key: 'maxPinned', kind: 'number', min: 1, max: 10 }],
  meetings: [
    { key: 'reminderHoursBefore', kind: 'hours', options: [1, 2, 6, 12, 24, 48, 72], max: 3 },
  ],
  events: [{ key: 'rsvpEnabledByDefault', kind: 'toggle' }],
  directory: [
    { key: 'allowPhoneOptIn', kind: 'toggle' },
    { key: 'staffVisible', kind: 'toggle' },
    { key: 'showVehicles', kind: 'choice', options: ['OFF', 'ADMINS', 'ALL'] },
  ],
  parking: [{ key: 'membersSeeAllAllocations', kind: 'toggle' }],
  tasks: [{ key: 'volunteeringEnabled', kind: 'toggle' }],
  responsibilities: [{ key: 'defaultRequiresConfirmation', kind: 'toggle' }],
  rewards: [
    { key: 'leaderboard', kind: 'choice', options: ['OFF', 'TOP_5', 'ALL'] },
    { key: 'dutiesEarnPoints', kind: 'toggle' },
    { key: 'maxPointsPerMonth', kind: 'number', min: 1, max: 1000, nullable: true },
  ],
  maintenance: [
    { key: 'transparency', kind: 'choice', options: ['OFF', 'STATUS', 'STATUS_AND_AMOUNT'] },
  ],
  expenses: [
    { key: 'visibleToMembers', kind: 'choice', options: ['NONE', 'SUMMARY', 'DETAILED'] },
    { key: 'approval', kind: 'choice', options: ['NEVER', 'ABOVE_AMOUNT', 'ALWAYS'] },
    { key: 'approvalThresholdPaise', kind: 'rupees' },
  ],
  vendors: [{ key: 'membersCanSuggest', kind: 'toggle' }],
  emergency: [
    { key: 'alertRecipients', kind: 'choice', options: ['ALL', 'ROLES'] },
    { key: 'roleIds', kind: 'roles', showWhen: { key: 'alertRecipients', value: 'ROLES' } },
    { key: 'cooldownMinutes', kind: 'number', min: 1, max: 60 },
  ],
  marketplace: [
    { key: 'foodEnabled', kind: 'toggle' },
    { key: 'resaleEnabled', kind: 'toggle' },
    { key: 'network', kind: 'toggle' },
  ],
};

/** Modules shown on the Modules screen, in hub order. */
export const MANAGED_MODULES: readonly ModuleKey[] = [
  'notices',
  'meetings',
  'events',
  'directory',
  'vendors',
  'parking',
  'tasks',
  'responsibilities',
  'rewards',
  'emergency',
  'maintenance',
  'expenses',
  'marketplace',
];

/** Permissions grouped the way a committee thinks about them. Every key appears once. */
type PermissionGroupKey =
  | 'society'
  | 'members'
  | 'communication'
  | 'work'
  | 'money'
  | 'services'
  | 'other';

export const PERMISSION_GROUPS: readonly {
  key: PermissionGroupKey;
  permissions: readonly PermissionKey[];
}[] = [
  {
    key: 'society',
    permissions: ['society.settings.manage', 'society.structure.manage', 'society.roles.manage'],
  },
  { key: 'members', permissions: ['member.manage', 'member.view_contact'] },
  {
    key: 'communication',
    permissions: ['notice.publish', 'notice.manage_all', 'meeting.manage', 'event.manage'],
  },
  {
    key: 'work',
    permissions: [
      'task.manage',
      'task.verify',
      'duty.manage',
      'duty.override',
      'reward.settings.manage',
      'reward.adjust',
      'reward.redeem_approve',
    ],
  },
  {
    key: 'money',
    permissions: [
      'maintenance.settings.manage',
      'maintenance.generate_bills',
      'maintenance.record_payment',
      'maintenance.waive',
      'maintenance.view_all',
      'expense.create',
      'expense.approve',
      'expense.manage_categories',
      'finance.reports.view',
    ],
  },
  {
    key: 'services',
    permissions: [
      'parking.manage',
      'vendor.manage',
      'emergency.contacts.manage',
      'emergency.alert.resolve',
    ],
  },
  {
    key: 'other',
    permissions: ['marketplace.moderate', 'marketplace.settings.manage', 'audit.view'],
  },
];

type Underscored<S extends string> = S extends `${infer A}.${infer B}`
  ? `${A}_${Underscored<B>}`
  : S;

/** i18next splits keys on dots, so dotted names are stored with underscores. */
export const i18nKey = <S extends string>(dotted: S) =>
  dotted.replace(/\./g, '_') as Underscored<S>;

export const MODULE_ICON: Record<ModuleKey, IconName> = {
  notices: 'notices',
  meetings: 'meetings',
  events: 'events',
  directory: 'directory',
  vendors: 'services',
  parking: 'parking',
  tasks: 'tasks',
  responsibilities: 'duties',
  rewards: 'rewards',
  emergency: 'emergency',
  maintenance: 'wallet',
  expenses: 'receipt',
  marketplace: 'market',
};

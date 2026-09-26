import { z } from 'zod';

/** Feature modules a society can switch on or off. Core modules are always on and are not listed. */
export const MODULE_KEYS = [
  'notices',
  'meetings',
  'events',
  'directory',
  'parking',
  'tasks',
  'responsibilities',
  'rewards',
  'maintenance',
  'expenses',
  'vendors',
  'emergency',
  'marketplace',
] as const;
export const ModuleKeySchema = z.enum(MODULE_KEYS);
export type ModuleKey = z.infer<typeof ModuleKeySchema>;

/** Every permission the backend can check. Roles are bundles of these. */
export const PERMISSION_KEYS = [
  'society.settings.manage',
  'society.structure.manage',
  'society.roles.manage',
  'member.manage',
  'member.view_contact',
  'parking.manage',
  'notice.publish',
  'notice.manage_all',
  'meeting.manage',
  'event.manage',
  'task.manage',
  'task.verify',
  'duty.manage',
  'duty.override',
  'reward.settings.manage',
  'reward.adjust',
  'reward.redeem_approve',
  'maintenance.settings.manage',
  'maintenance.generate_bills',
  'maintenance.record_payment',
  'maintenance.waive',
  'maintenance.view_all',
  'expense.create',
  'expense.approve',
  'expense.manage_categories',
  'finance.reports.view',
  'vendor.manage',
  'emergency.contacts.manage',
  'emergency.alert.resolve',
  'marketplace.moderate',
  'marketplace.settings.manage',
  'audit.view',
] as const;
export const PermissionKeySchema = z.enum(PERMISSION_KEYS);
export type PermissionKey = z.infer<typeof PermissionKeySchema>;

/** Role templates seeded into every society. Admins can add more. */
export const ROLE_TEMPLATE_KEYS = ['admin', 'committee', 'treasurer', 'resident', 'staff'] as const;
export const RoleTemplateKeySchema = z.enum(ROLE_TEMPLATE_KEYS);
export type RoleTemplateKey = z.infer<typeof RoleTemplateKeySchema>;

export const ROLE_TEMPLATE_PERMISSIONS: Record<RoleTemplateKey, readonly PermissionKey[]> = {
  admin: PERMISSION_KEYS,
  committee: [
    'member.view_contact',
    'parking.manage',
    'notice.publish',
    'meeting.manage',
    'event.manage',
    'task.manage',
    'task.verify',
    'duty.manage',
    'duty.override',
    'maintenance.view_all',
    'expense.create',
    'expense.approve',
    'finance.reports.view',
    'vendor.manage',
    'emergency.contacts.manage',
    'emergency.alert.resolve',
    'marketplace.moderate',
  ],
  treasurer: [
    'member.view_contact',
    'reward.adjust',
    'reward.redeem_approve',
    'maintenance.settings.manage',
    'maintenance.generate_bills',
    'maintenance.record_payment',
    'maintenance.waive',
    'maintenance.view_all',
    'expense.create',
    'expense.approve',
    'expense.manage_categories',
    'finance.reports.view',
    'audit.view',
  ],
  resident: [],
  staff: ['member.view_contact', 'emergency.alert.resolve'],
};

export const MembershipStatusSchema = z.enum([
  'INVITED',
  'PENDING_APPROVAL',
  'ACTIVE',
  'SUSPENDED',
  'LEFT',
]);
export type MembershipStatus = z.infer<typeof MembershipStatusSchema>;

export const OccupancyRelationSchema = z.enum(['OWNER', 'TENANT', 'FAMILY', 'OTHER']);
export type OccupancyRelation = z.infer<typeof OccupancyRelationSchema>;

export const FlatStatusSchema = z.enum(['OCCUPIED', 'VACANT', 'INACTIVE']);
export type FlatStatus = z.infer<typeof FlatStatusSchema>;

export const InvitationStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED']);
export const JoinRequestStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

export const NotificationCategorySchema = z.enum([
  'NOTICE',
  'MEETING',
  'EVENT',
  'TASK',
  'DUTY',
  'MAINTENANCE',
  'EXPENSE',
  'EMERGENCY',
  'MARKETPLACE',
  'MEMBERSHIP',
  'SYSTEM',
]);
export type NotificationCategory = z.infer<typeof NotificationCategorySchema>;

/** Categories a member may not switch off. */
export const LOCKED_NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = [
  'EMERGENCY',
  'MEMBERSHIP',
];

export const AuditActionSchema = z.enum([
  'society.created',
  'society.settings.updated',
  'society.module.updated',
  'building.created',
  'building.updated',
  'flat.created',
  'flat.updated',
  'invitation.created',
  'invitation.revoked',
  'invitation.accepted',
  'join_request.approved',
  'join_request.rejected',
  'member.roles.updated',
  'member.status.updated',
  'member.occupancy.updated',
  'member.reset_code.issued',
  'role.created',
  'role.updated',
  'role.deleted',
  'notice.published',
  'notice.updated',
  'notice.archived',
  'notice.pinned',
  'parking.slot.created',
  'parking.slot.updated',
  'parking.allocated',
  'parking.released',
  'vehicle.created',
  'vehicle.updated',
  'vehicle.deleted',
  'vendor.category.created',
  'vendor.category.updated',
  'vendor.category.deleted',
  'vendor.created',
  'vendor.suggested',
  'vendor.updated',
  'vendor.deleted',
  'emergency.contact.created',
  'emergency.contact.updated',
  'emergency.contact.deleted',
  'alert.raised',
  'alert.resolved',
  'meeting.created',
  'meeting.updated',
  'meeting.rescheduled',
  'meeting.note_added',
  'meeting.cancelled',
  'meeting.completed',
  'event.created',
  'event.updated',
  'event.cancelled',
  'billing_plan.created',
  'billing_plan.updated',
  'billing_plan.override_set',
  'bills.generated',
  'bills.adhoc_created',
  'bill.waived',
  'bill.late_fee_waived',
  'payment.recorded',
  'payment.reversed',
  'payment_instruction.created',
  'payment_instruction.updated',
  'payment_instruction.deleted',
  'expense.category.created',
  'expense.category.updated',
  'expense.category.deleted',
  'expense.created',
  'expense.updated',
  'expense.approved',
  'expense.rejected',
  'expense.deleted',
  'income.created',
  'income.deleted',
  'duty.created',
  'duty.updated',
  'duty.participants.updated',
  'duty.status.updated',
  'duty.confirmed',
  'duty.overridden',
  'task.created',
  'task.updated',
  'task.assigned',
  'task.verified',
  'task.returned',
  'task.cancelled',
  'points.adjusted',
  'user.deleted',
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const DevicePlatformSchema = z.enum(['ANDROID', 'IOS']);

import { societyAuditRoutes } from './audit.contract';
import { societyInvitationRoutes } from './invitations.contract';
import { societyJoinRequestRoutes } from './join-requests.contract';
import { societyMemberRoutes } from './members.contract';
import { societyModuleRoutes } from './modules.contract';
import { societyProfileRoutes } from './profile.contract';
import { societyRoleRoutes } from './roles.contract';
import { societyStructureRoutes } from './structure.contract';

export {
  AUDIT_AREAS,
  type AuditArea,
  AuditAreaSchema,
  type AuditEntry,
  AuditEntrySchema,
} from './audit.contract';
export { type Invitation, InvitationSchema } from './invitations.contract';
export { type JoinRequest, JoinRequestSchema } from './join-requests.contract';
export {
  type MemberCard,
  MemberCardSchema,
  type MemberDetail,
  MemberDetailSchema,
} from './members.contract';
export { type SocietyProfile, SocietyProfileSchema } from './profile.contract';
export { type Role, RoleSchema } from './roles.contract';
export {
  type Building,
  BuildingSchema,
  type Flat,
  FlatOccupantSchema,
  FlatSchema,
} from './structure.contract';

/** Every society route. The parts live in one file per area; keys and order are unchanged. */
export const societyContract = {
  ...societyProfileRoutes,
  ...societyStructureRoutes,
  ...societyMemberRoutes,
  ...societyRoleRoutes,
  ...societyAuditRoutes,
  ...societyInvitationRoutes,
  ...societyJoinRequestRoutes,
  ...societyModuleRoutes,
};

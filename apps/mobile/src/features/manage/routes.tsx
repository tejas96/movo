import type { ModuleKey } from '@movo/contracts';
import type { FeatureRoutes } from '../../core/navigation/routes';
import { AuditLogScreen } from './AuditLogScreen';
import { InvitationsScreen } from './InvitationsScreen';
import { InviteMemberScreen } from './InviteMemberScreen';
import { JoinRequestsScreen } from './JoinRequestsScreen';
import { ManageHomeScreen } from './ManageHomeScreen';
import { ModuleSettingsScreen } from './ModuleSettingsScreen';
import { ModulesScreen } from './ModulesScreen';
import { RoleEditorScreen } from './RoleEditorScreen';
import { RolesScreen } from './RolesScreen';
import { SocietyProfileScreen } from './SocietyProfileScreen';
import { StructureScreen } from './StructureScreen';

export type ManageParams = {
  Manage: undefined;
  Invitations: undefined;
  InviteMember: undefined;
  JoinRequests: undefined;
  Structure: undefined;
  SocietyProfile: undefined;
  Roles: undefined;
  RoleEditor: { roleId?: string } | undefined;
  Modules: undefined;
  ModuleSettings: { moduleKey: ModuleKey };
  AuditLog: undefined;
};

export const manageRoutes: FeatureRoutes<ManageParams> = {
  screens: [
    { name: 'Manage', component: ManageHomeScreen, group: 'app' },
    { name: 'Invitations', component: InvitationsScreen, group: 'app' },
    { name: 'InviteMember', component: InviteMemberScreen, group: 'app' },
    { name: 'JoinRequests', component: JoinRequestsScreen, group: 'app' },
    { name: 'Structure', component: StructureScreen, group: 'app' },
    { name: 'SocietyProfile', component: SocietyProfileScreen, group: 'app' },
    { name: 'Roles', component: RolesScreen, group: 'app' },
    { name: 'RoleEditor', component: RoleEditorScreen, group: 'app' },
    { name: 'Modules', component: ModulesScreen, group: 'app' },
    { name: 'ModuleSettings', component: ModuleSettingsScreen, group: 'app' },
    { name: 'AuditLog', component: AuditLogScreen, group: 'app' },
  ],
  notifications: [{ kind: 'manage/join-requests', route: 'JoinRequests' }],
};

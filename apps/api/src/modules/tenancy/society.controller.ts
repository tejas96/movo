import { type RouteInput, type RouteResponse, societyContract } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { AuditLogService } from './audit-log.service';
import { InvitationsService } from './invitations.service';
import { JoinRequestsService } from './join-requests.service';
import { MembersService } from './members.service';
import { ModulesService } from './modules.service';
import { RolesService } from './roles.service';
import { SocietiesService } from './societies.service';
import { StructureService } from './structure.service';

const c = societyContract;
type In<K extends keyof typeof c> = RouteInput<(typeof c)[K]>;
type Out<K extends keyof typeof c> = Promise<RouteResponse<(typeof c)[K]>>;

@Controller()
export class SocietyController {
  constructor(
    private readonly societies: SocietiesService,
    private readonly structure: StructureService,
    private readonly members: MembersService,
    private readonly roles: RolesService,
    private readonly invitations: InvitationsService,
    private readonly joinRequests: JoinRequestsService,
    private readonly modules: ModulesService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Route(c.get) get(): Out<'get'> {
    return this.societies.profile();
  }
  @Route(c.update) update(@Input(c.update) { body }: In<'update'>): Out<'update'> {
    return this.societies.update(body);
  }

  @Route(c.listBuildings) listBuildings(): Out<'listBuildings'> {
    return this.structure.listBuildings();
  }
  @Route(c.createBuilding) createBuilding(
    @Input(c.createBuilding) { body }: In<'createBuilding'>,
  ): Out<'createBuilding'> {
    return this.structure.createBuilding(body);
  }
  @Route(c.updateBuilding) updateBuilding(
    @Input(c.updateBuilding) { params, body }: In<'updateBuilding'>,
  ): Out<'updateBuilding'> {
    return this.structure.updateBuilding(params.buildingId, body);
  }

  @Route(c.listFlats) listFlats(@Input(c.listFlats) { query }: In<'listFlats'>): Out<'listFlats'> {
    return this.structure.listFlats(query.buildingId);
  }
  @Route(c.createFlats) createFlats(
    @Input(c.createFlats) { body }: In<'createFlats'>,
  ): Out<'createFlats'> {
    return this.structure.createFlats(body);
  }
  @Route(c.updateFlat) updateFlat(
    @Input(c.updateFlat) { params, body }: In<'updateFlat'>,
  ): Out<'updateFlat'> {
    return this.structure.updateFlat(params.flatId, body);
  }

  @Route(c.listMembers) listMembers(
    @Input(c.listMembers) { query }: In<'listMembers'>,
  ): Out<'listMembers'> {
    return this.members.list(query);
  }
  @Route(c.getMyPrivacy) getMyPrivacy(): Out<'getMyPrivacy'> {
    return this.members.getMyPrivacy();
  }
  @Route(c.updateMyPrivacy) updateMyPrivacy(
    @Input(c.updateMyPrivacy) { body }: In<'updateMyPrivacy'>,
  ): Out<'updateMyPrivacy'> {
    return this.members.updateMyPrivacy(body);
  }
  @Route(c.getMember) getMember(@Input(c.getMember) { params }: In<'getMember'>): Out<'getMember'> {
    return this.members.get(params.membershipId);
  }
  @Route(c.updateMember) updateMember(
    @Input(c.updateMember) { params, body }: In<'updateMember'>,
  ): Out<'updateMember'> {
    return this.members.update(params.membershipId, body);
  }
  @Route(c.setOccupancies) setOccupancies(
    @Input(c.setOccupancies) { params, body }: In<'setOccupancies'>,
  ): Out<'setOccupancies'> {
    return this.members.setOccupancies(params.membershipId, body);
  }
  @Route(c.issueResetCode) issueResetCode(
    @Input(c.issueResetCode) { params }: In<'issueResetCode'>,
  ): Out<'issueResetCode'> {
    return this.members.issueResetCode(params.membershipId);
  }

  @Route(c.listRoles) listRoles(): Out<'listRoles'> {
    return this.roles.list();
  }
  @Route(c.createRole) createRole(
    @Input(c.createRole) { body }: In<'createRole'>,
  ): Out<'createRole'> {
    return this.roles.create(body);
  }
  @Route(c.updateRole) updateRole(
    @Input(c.updateRole) { params, body }: In<'updateRole'>,
  ): Out<'updateRole'> {
    return this.roles.update(params.roleId, body);
  }
  @Route(c.deleteRole) async deleteRole(
    @Input(c.deleteRole) { params }: In<'deleteRole'>,
  ): Out<'deleteRole'> {
    await this.roles.remove(params.roleId);
    return { ok: true };
  }

  @Route(c.listAudit) listAudit(@Input(c.listAudit) { query }: In<'listAudit'>): Out<'listAudit'> {
    return this.auditLog.list(query);
  }

  @Route(c.listInvitations) listInvitations(
    @Input(c.listInvitations) { query }: In<'listInvitations'>,
  ): Out<'listInvitations'> {
    return this.invitations.list(query);
  }
  @Route(c.createInvitation) createInvitation(
    @Input(c.createInvitation) { body }: In<'createInvitation'>,
  ): Out<'createInvitation'> {
    return this.invitations.create(body);
  }
  @Route(c.revokeInvitation) async revokeInvitation(
    @Input(c.revokeInvitation) { params }: In<'revokeInvitation'>,
  ): Out<'revokeInvitation'> {
    await this.invitations.revoke(params.invitationId);
    return { ok: true };
  }

  @Route(c.listJoinRequests) listJoinRequests(
    @Input(c.listJoinRequests) { query }: In<'listJoinRequests'>,
  ): Out<'listJoinRequests'> {
    return this.joinRequests.list(query.status);
  }
  @Route(c.approveJoinRequest) approveJoinRequest(
    @Input(c.approveJoinRequest) { params, body }: In<'approveJoinRequest'>,
  ): Out<'approveJoinRequest'> {
    return this.joinRequests.approve(params.requestId, body);
  }
  @Route(c.rejectJoinRequest) async rejectJoinRequest(
    @Input(c.rejectJoinRequest) { params, body }: In<'rejectJoinRequest'>,
  ): Out<'rejectJoinRequest'> {
    await this.joinRequests.reject(params.requestId, body.reason);
    return { ok: true };
  }

  @Route(c.listModules) listModules(): Out<'listModules'> {
    return this.modules.list();
  }
  @Route(c.updateModule) updateModule(
    @Input(c.updateModule) { params, body }: In<'updateModule'>,
  ): Out<'updateModule'> {
    return this.modules.update(params.moduleKey, body);
  }
}

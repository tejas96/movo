import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { IdentityModule } from '../identity/identity.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ContextService } from './context.service';
import { InvitationsService } from './invitations.service';
import { JoinController } from './join.controller';
import { JoinRequestsService } from './join-requests.service';
import { MembersService } from './members.service';
import { ModulesService } from './modules.service';
import { PlatformController } from './platform.controller';
import { RolesService } from './roles.service';
import { SocietiesService } from './societies.service';
import { SocietyController } from './society.controller';
import { StructureService } from './structure.service';

@Module({
  imports: [IdentityModule, NotificationsModule],
  controllers: [PlatformController, JoinController, SocietyController],
  providers: [
    ContextService,
    SocietiesService,
    StructureService,
    MembersService,
    RolesService,
    InvitationsService,
    JoinRequestsService,
    ModulesService,
    AuditService,
  ],
  exports: [ContextService, SocietiesService, RolesService],
})
export class TenancyModule {}

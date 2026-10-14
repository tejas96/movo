import { Module, type OnModuleInit } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { HOME_ORDER, HomeRegistry } from '../../common/home/home-registry';
import { Lifecycle } from '../../common/lifecycle/lifecycle';
import { NotificationsModule } from '../notifications/notifications.module';
import { DutiesController } from './duties.controller';
import { DutiesJob } from './duties.job';
import { leaveDutiesOnAccountDeleted } from './duties.lifecycle';
import { DutiesService } from './duties.service';
import { DutyTurns } from './duty-turns.service';

@Module({
  imports: [NotificationsModule],
  controllers: [DutiesController],
  providers: [DutiesService, DutyTurns, DutiesJob],
  exports: [DutiesService],
})
export class DutiesModule implements OnModuleInit {
  constructor(
    private readonly lifecycle: Lifecycle,
    private readonly audit: AuditService,
    private readonly home: HomeRegistry,
    private readonly duties: DutiesService,
  ) {}

  onModuleInit(): void {
    this.lifecycle.onAccountDeleted(leaveDutiesOnAccountDeleted(this.audit));
    this.home.register({
      module: 'responsibilities',
      order: HOME_ORDER.duties,
      load: async (ctx) => ({ attention: await this.duties.attentionForHome(ctx) }),
    });
  }
}

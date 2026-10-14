import { Module, type OnModuleInit } from '@nestjs/common';
import { HOME_ORDER, HomeRegistry } from '../../common/home/home-registry';
import { NotificationsModule } from '../notifications/notifications.module';
import { DutiesController } from './duties.controller';
import { DutiesJob } from './duties.job';
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
    private readonly home: HomeRegistry,
    private readonly duties: DutiesService,
  ) {}

  onModuleInit(): void {
    this.home.register({
      module: 'responsibilities',
      order: HOME_ORDER.duties,
      load: async (ctx) => ({ attention: await this.duties.attentionForHome(ctx) }),
    });
  }
}

import { Module, type OnModuleInit } from '@nestjs/common';
import { HOME_ORDER, HomeRegistry } from '../../common/home/home-registry';
import { Lifecycle } from '../../common/lifecycle/lifecycle';
import { NotificationsModule } from '../notifications/notifications.module';
import { EmergencyController } from './emergency.controller';
import { defaultEmergencyContactRows, EmergencyService } from './emergency.service';

@Module({
  imports: [NotificationsModule],
  controllers: [EmergencyController],
  providers: [EmergencyService],
  exports: [EmergencyService],
})
export class EmergencyModule implements OnModuleInit {
  constructor(
    private readonly lifecycle: Lifecycle,
    private readonly home: HomeRegistry,
    private readonly emergency: EmergencyService,
  ) {}

  onModuleInit(): void {
    this.lifecycle.onSocietyCreated((tx, societyId) =>
      tx.emergencyContact.createMany({ data: defaultEmergencyContactRows(societyId) }),
    );
    this.home.register({
      module: 'emergency',
      order: HOME_ORDER.emergency,
      load: async () => ({ attention: await this.emergency.attentionForHome() }),
    });
  }
}

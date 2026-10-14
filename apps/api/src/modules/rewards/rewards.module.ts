import { Module, type OnModuleInit } from '@nestjs/common';
import { HOME_ORDER, HomeRegistry } from '../../common/home/home-registry';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  controllers: [RewardsController],
  providers: [RewardsService],
  exports: [RewardsService],
})
export class RewardsModule implements OnModuleInit {
  constructor(
    private readonly home: HomeRegistry,
    private readonly rewards: RewardsService,
  ) {}

  onModuleInit(): void {
    this.home.register({
      module: 'rewards',
      order: HOME_ORDER.rewards,
      load: async (ctx) => ({ points: await this.rewards.pointsThisYear(ctx) }),
    });
  }
}

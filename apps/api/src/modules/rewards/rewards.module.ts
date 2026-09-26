import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  controllers: [RewardsController],
  providers: [RewardsService, AuditService],
  exports: [RewardsService],
})
export class RewardsModule {}

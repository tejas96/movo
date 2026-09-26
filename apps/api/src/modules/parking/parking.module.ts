import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ParkingController } from './parking.controller';
import { ParkingService } from './parking.service';

@Module({
  controllers: [ParkingController],
  providers: [ParkingService, AuditService],
  exports: [ParkingService],
})
export class ParkingModule {}

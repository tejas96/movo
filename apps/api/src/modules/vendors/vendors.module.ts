import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { VendorsController } from './vendors.controller';
import { VendorsService } from './vendors.service';

@Module({
  controllers: [VendorsController],
  providers: [VendorsService, AuditService],
  exports: [VendorsService],
})
export class VendorsModule {}

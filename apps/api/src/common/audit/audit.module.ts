import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** One AuditService for the whole app; feature modules inject it without registering it. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}

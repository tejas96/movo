import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [NotificationsModule, FilesModule],
  controllers: [TasksController],
  providers: [TasksService, AuditService],
  exports: [TasksService],
})
export class TasksModule {}

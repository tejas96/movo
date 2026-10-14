import { Module, type OnModuleInit } from '@nestjs/common';
import { HOME_ORDER, HomeRegistry } from '../../common/home/home-registry';
import { Lifecycle } from '../../common/lifecycle/lifecycle';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [NotificationsModule, FilesModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule implements OnModuleInit {
  constructor(
    private readonly lifecycle: Lifecycle,
    private readonly home: HomeRegistry,
    private readonly tasks: TasksService,
  ) {}

  onModuleInit(): void {
    this.lifecycle.onMemberLeft((tx, e) => this.tasks.releaseForLeaver(tx, e));
    this.home.register({
      module: 'tasks',
      order: HOME_ORDER.tasks,
      load: async (ctx) => {
        const [attention, openTasks] = await Promise.all([
          this.tasks.attentionForHome(ctx),
          // Only the rewards card shows the count.
          ctx.enabledModules.has('rewards') ? this.tasks.openTaskCount(ctx) : undefined,
        ]);
        return { attention, openTasks };
      },
    });
  }
}

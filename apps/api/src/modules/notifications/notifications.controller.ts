import { meContract, type RouteInput, type RouteResponse } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { requireUser } from '../../common/request-store';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { NotificationsService } from './notifications.service';

const c = meContract;

@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Route(c.notifications)
  list(
    @Input(c.notifications) { query }: RouteInput<typeof c.notifications>,
  ): Promise<RouteResponse<typeof c.notifications>> {
    return this.notifications.list(requireUser().id, query.cursor, query.limit);
  }

  @Route(c.markNotificationRead)
  async markRead(
    @Input(c.markNotificationRead) { params }: RouteInput<typeof c.markNotificationRead>,
  ): Promise<{ ok: true }> {
    await this.notifications.markRead(requireUser().id, params.notificationId);
    return { ok: true };
  }

  @Route(c.markAllNotificationsRead)
  async markAllRead(): Promise<{ ok: true }> {
    await this.notifications.markAllRead(requireUser().id);
    return { ok: true };
  }
}

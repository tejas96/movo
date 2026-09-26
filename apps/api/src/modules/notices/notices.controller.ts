import { noticesContract, type RouteInput, type RouteResponse } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { NoticesService } from './notices.service';

const c = noticesContract;
type In<K extends keyof typeof c> = RouteInput<(typeof c)[K]>;
type Out<K extends keyof typeof c> = Promise<RouteResponse<(typeof c)[K]>>;

@Controller()
export class NoticesController {
  constructor(private readonly notices: NoticesService) {}

  @Route(c.list) list(@Input(c.list) { query }: In<'list'>): Out<'list'> {
    return this.notices.list(query);
  }
  @Route(c.create) create(@Input(c.create) { body }: In<'create'>): Out<'create'> {
    return this.notices.create(body);
  }
  @Route(c.get) get(@Input(c.get) { params }: In<'get'>): Out<'get'> {
    return this.notices.get(params.noticeId);
  }
  @Route(c.update) update(@Input(c.update) { params, body }: In<'update'>): Out<'update'> {
    return this.notices.update(params.noticeId, body);
  }
  @Route(c.publish) publish(@Input(c.publish) { params }: In<'publish'>): Out<'publish'> {
    return this.notices.publish(params.noticeId);
  }
  @Route(c.archive) archive(@Input(c.archive) { params }: In<'archive'>): Out<'archive'> {
    return this.notices.archive(params.noticeId);
  }
  @Route(c.setPinned) setPinned(
    @Input(c.setPinned) { params, body }: In<'setPinned'>,
  ): Out<'setPinned'> {
    return this.notices.setPinned(params.noticeId, body.isPinned);
  }
  @Route(c.markRead) async markRead(
    @Input(c.markRead) { params }: In<'markRead'>,
  ): Out<'markRead'> {
    await this.notices.markRead(params.noticeId);
    return { ok: true };
  }
}

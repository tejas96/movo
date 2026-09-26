import { meetingsContract, type RouteInput, type RouteResponse } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { MeetingsService } from './meetings.service';

const c = meetingsContract;
type In<K extends keyof typeof c> = RouteInput<(typeof c)[K]>;
type Out<K extends keyof typeof c> = Promise<RouteResponse<(typeof c)[K]>>;

@Controller()
export class MeetingsController {
  constructor(private readonly meetings: MeetingsService) {}

  @Route(c.list) list(@Input(c.list) { query }: In<'list'>): Out<'list'> {
    return this.meetings.list(query);
  }
  @Route(c.create) create(@Input(c.create) { body }: In<'create'>): Out<'create'> {
    return this.meetings.create(body);
  }
  @Route(c.get) get(@Input(c.get) { params }: In<'get'>): Out<'get'> {
    return this.meetings.get(params.meetingId);
  }
  @Route(c.update) update(@Input(c.update) { params, body }: In<'update'>): Out<'update'> {
    return this.meetings.update(params.meetingId, body);
  }
  @Route(c.addNote) addNote(@Input(c.addNote) { params, body }: In<'addNote'>): Out<'addNote'> {
    return this.meetings.addNote(params.meetingId, body.note);
  }
  @Route(c.cancel) cancel(@Input(c.cancel) { params, body }: In<'cancel'>): Out<'cancel'> {
    return this.meetings.cancel(params.meetingId, body.note);
  }
  @Route(c.complete) complete(
    @Input(c.complete) { params, body }: In<'complete'>,
  ): Out<'complete'> {
    return this.meetings.complete(params.meetingId, body.note);
  }
}

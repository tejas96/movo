import { eventsContract, type RouteInput, type RouteResponse } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { EventsService } from './events.service';

const c = eventsContract;
type In<K extends keyof typeof c> = RouteInput<(typeof c)[K]>;
type Out<K extends keyof typeof c> = Promise<RouteResponse<(typeof c)[K]>>;

@Controller()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Route(c.list) list(@Input(c.list) { query }: In<'list'>): Out<'list'> {
    return this.events.list(query);
  }
  @Route(c.create) create(@Input(c.create) { body }: In<'create'>): Out<'create'> {
    return this.events.create(body);
  }
  @Route(c.get) get(@Input(c.get) { params }: In<'get'>): Out<'get'> {
    return this.events.get(params.eventId);
  }
  @Route(c.update) update(@Input(c.update) { params, body }: In<'update'>): Out<'update'> {
    return this.events.update(params.eventId, body);
  }
  @Route(c.cancel) cancel(@Input(c.cancel) { params, body }: In<'cancel'>): Out<'cancel'> {
    return this.events.cancel(params.eventId, body.reason);
  }
  @Route(c.rsvp) rsvp(@Input(c.rsvp) { params, body }: In<'rsvp'>): Out<'rsvp'> {
    return this.events.rsvp(params.eventId, body);
  }
  @Route(c.listRsvps) listRsvps(@Input(c.listRsvps) { params }: In<'listRsvps'>): Out<'listRsvps'> {
    return this.events.listRsvps(params.eventId);
  }
}

import { dutiesContract, type RouteInput, type RouteResponse } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { DutiesService } from './duties.service';

const c = dutiesContract;
type In<K extends keyof typeof c> = RouteInput<(typeof c)[K]>;
type Out<K extends keyof typeof c> = Promise<RouteResponse<(typeof c)[K]>>;

@Controller()
export class DutiesController {
  constructor(private readonly duties: DutiesService) {}

  @Route(c.list) list(@Input(c.list) { query }: In<'list'>): Out<'list'> {
    return this.duties.list(query.mine === 'true');
  }
  @Route(c.create) create(@Input(c.create) { body }: In<'create'>): Out<'create'> {
    return this.duties.create(body);
  }
  @Route(c.get) get(@Input(c.get) { params }: In<'get'>): Out<'get'> {
    return this.duties.get(params.dutyId);
  }
  @Route(c.update) update(@Input(c.update) { params, body }: In<'update'>): Out<'update'> {
    return this.duties.update(params.dutyId, body);
  }
  @Route(c.setParticipants) setParticipants(
    @Input(c.setParticipants) { params, body }: In<'setParticipants'>,
  ): Out<'setParticipants'> {
    return this.duties.setParticipants(params.dutyId, body.participantIds);
  }
  @Route(c.setStatus) setStatus(
    @Input(c.setStatus) { params, body }: In<'setStatus'>,
  ): Out<'setStatus'> {
    return this.duties.setStatus(params.dutyId, body.status);
  }
  @Route(c.confirm) confirm(@Input(c.confirm) { params }: In<'confirm'>): Out<'confirm'> {
    return this.duties.confirm(params.dutyId, params.assignmentId);
  }
  @Route(c.override) override(
    @Input(c.override) { params, body }: In<'override'>,
  ): Out<'override'> {
    return this.duties.override(params.dutyId, params.assignmentId, body);
  }
}

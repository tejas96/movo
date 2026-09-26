import { type RouteInput, type RouteResponse, tasksContract } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { TasksService } from './tasks.service';

const c = tasksContract;
type In<K extends keyof typeof c> = RouteInput<(typeof c)[K]>;
type Out<K extends keyof typeof c> = Promise<RouteResponse<(typeof c)[K]>>;

@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Route(c.list) list(@Input(c.list) { query }: In<'list'>): Out<'list'> {
    return this.tasks.list(query.view);
  }
  @Route(c.create) create(@Input(c.create) { body }: In<'create'>): Out<'create'> {
    return this.tasks.create(body);
  }
  @Route(c.get) get(@Input(c.get) { params }: In<'get'>): Out<'get'> {
    return this.tasks.get(params.taskId);
  }
  @Route(c.update) update(@Input(c.update) { params, body }: In<'update'>): Out<'update'> {
    return this.tasks.update(params.taskId, body);
  }
  @Route(c.assign) assign(@Input(c.assign) { params, body }: In<'assign'>): Out<'assign'> {
    return this.tasks.assign(params.taskId, body.membershipId);
  }
  @Route(c.volunteer) volunteer(@Input(c.volunteer) { params }: In<'volunteer'>): Out<'volunteer'> {
    return this.tasks.volunteer(params.taskId);
  }
  @Route(c.withdraw) withdraw(@Input(c.withdraw) { params }: In<'withdraw'>): Out<'withdraw'> {
    return this.tasks.withdraw(params.taskId);
  }
  @Route(c.submit) submit(@Input(c.submit) { params, body }: In<'submit'>): Out<'submit'> {
    return this.tasks.submit(params.taskId, body.note);
  }
  @Route(c.verify) verify(@Input(c.verify) { params }: In<'verify'>): Out<'verify'> {
    return this.tasks.verify(params.taskId);
  }
  @Route(c.sendBack) sendBack(
    @Input(c.sendBack) { params, body }: In<'sendBack'>,
  ): Out<'sendBack'> {
    return this.tasks.sendBack(params.taskId, body.reason);
  }
  @Route(c.cancel) cancel(@Input(c.cancel) { params }: In<'cancel'>): Out<'cancel'> {
    return this.tasks.cancel(params.taskId);
  }
}

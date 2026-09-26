import { meContract, type RouteInput, type User } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { requireUser } from '../../common/request-store';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { AuthService } from './auth.service';
import { MeService } from './me.service';

const c = meContract;

@Controller()
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly auth: AuthService,
  ) {}

  @Route(c.get)
  get(): Promise<User> {
    return this.me.get(requireUser().id);
  }

  @Route(c.update)
  update(@Input(c.update) { body }: RouteInput<typeof c.update>): Promise<User> {
    return this.me.update(requireUser().id, body);
  }

  @Route(c.deleteAccount)
  async deleteAccount(
    @Input(c.deleteAccount) { body }: RouteInput<typeof c.deleteAccount>,
  ): Promise<{ ok: true }> {
    await this.auth.deleteAccount(requireUser().id, body.password);
    return { ok: true };
  }

  @Route(c.registerDevice)
  async registerDevice(
    @Input(c.registerDevice) { body }: RouteInput<typeof c.registerDevice>,
  ): Promise<{ ok: true }> {
    await this.me.registerDevice(requireUser().id, body.token, body.platform, body.appVersion);
    return { ok: true };
  }

  @Route(c.removeDevice)
  async removeDevice(
    @Input(c.removeDevice) { body }: RouteInput<typeof c.removeDevice>,
  ): Promise<{ ok: true }> {
    await this.me.removeDevice(requireUser().id, body.token);
    return { ok: true };
  }
}

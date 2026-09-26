import { type AuthSession, type AuthTokens, authContract, type RouteInput } from '@movo/contracts';
import { Controller } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { requireUser } from '../../common/request-store';
import { Input } from '../../common/route/input.decorator';
import { Route } from '../../common/route/route.decorator';
import { AuthService } from './auth.service';

const c = authContract;

@Controller()
@Throttle({ default: { limit: 10, ttl: 60_000 } })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Route(c.register)
  register(@Input(c.register) { body }: RouteInput<typeof c.register>): Promise<AuthSession> {
    return this.auth.register(body);
  }

  @Route(c.login)
  login(@Input(c.login) { body }: RouteInput<typeof c.login>): Promise<AuthSession> {
    return this.auth.login(body);
  }

  @Route(c.refresh)
  refresh(@Input(c.refresh) { body }: RouteInput<typeof c.refresh>): Promise<AuthTokens> {
    return this.auth.refresh(body.refreshToken);
  }

  @Route(c.logout)
  async logout(@Input(c.logout) { body }: RouteInput<typeof c.logout>): Promise<{ ok: true }> {
    await this.auth.logout(requireUser().sessionId, body.refreshToken);
    return { ok: true };
  }

  @Route(c.forgotPassword)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgotPassword(
    @Input(c.forgotPassword) { body }: RouteInput<typeof c.forgotPassword>,
  ): Promise<{ ok: true }> {
    await this.auth.forgotPassword(body.identifier);
    return { ok: true };
  }

  @Route(c.resetPassword)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resetPassword(
    @Input(c.resetPassword) { body }: RouteInput<typeof c.resetPassword>,
  ): Promise<{ ok: true }> {
    await this.auth.resetPassword(body);
    return { ok: true };
  }

  @Route(c.changePassword)
  async changePassword(
    @Input(c.changePassword) { body }: RouteInput<typeof c.changePassword>,
  ): Promise<{ ok: true }> {
    const user = requireUser();
    await this.auth.changePassword(user.id, user.sessionId, body.currentPassword, body.newPassword);
    return { ok: true };
  }
}

import type { RouteDef } from '@movo/contracts';
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SessionsService } from '../../modules/identity/sessions.service';
import { UsersService } from '../../modules/identity/users.service';
import { ContextService } from '../../modules/tenancy/context.service';
import { JwtService } from '../auth/jwt.service';
import { ApiException } from '../errors/api.exception';
import { PrismaService } from '../prisma/prisma.service';
import { requireStore } from '../request-store';
import { TtlCache } from '../tenant/tenant-cache';
import { ROUTE_META } from './route.decorator';

const USER_TTL_MS = 60_000;

/**
 * One guard, one order, for every route:
 * bearer token -> live session -> active user -> platform admin (if required)
 * -> membership in :societyId -> module enabled -> permission held.
 */
@Injectable()
export class RouteGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly sessions: SessionsService,
    private readonly users: UsersService,
    private readonly context: ContextService,
    private readonly prisma: PrismaService,
    private readonly cache: TtlCache,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const def = this.reflector.get<RouteDef | undefined>(ROUTE_META, ctx.getHandler());
    if (!def) return true;
    const req = ctx.switchToHttp().getRequest<Request>();
    const store = requireStore();

    if (def.auth !== 'none') {
      const header = req.header('authorization') ?? '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : '';
      if (!token) throw ApiException.unauthenticated();
      const claims = await this.jwt.verify(token);
      if (!claims) throw ApiException.unauthenticated('Token is not valid');
      if (!(await this.sessions.isSessionLive(claims.sid)))
        throw ApiException.unauthenticated('Session ended');
      const user = await this.cachedUser(claims.sub);
      if (!user) throw ApiException.unauthenticated('Account is not active');
      store.user = { id: user.id, sessionId: claims.sid, locale: user.locale };

      if (def.auth === 'platform') {
        const admin = await this.prisma.platformAdmin.findUnique({ where: { userId: user.id } });
        if (!admin) throw ApiException.forbidden();
      }
    }

    const societyId = (req.params as Record<string, string | undefined>).societyId;
    if (societyId && def.auth === 'user' && store.user) {
      const lookup = await this.context.lookupTenant(store.user.id, societyId);
      if (lookup.kind === 'none') throw ApiException.notFound('Society not found');
      if (lookup.kind === 'inactive')
        throw new ApiException(
          'MEMBERSHIP_INACTIVE',
          'Your membership is not active in this society',
          403,
        );
      store.tenant = lookup.ctx;
      if (def.module !== 'core' && !lookup.ctx.enabledModules.has(def.module)) {
        throw new ApiException(
          'MODULE_DISABLED',
          'This module is switched off for your society',
          403,
        );
      }
      if (def.permission && !lookup.ctx.permissions.has(def.permission))
        throw ApiException.forbidden();
    }
    return true;
  }

  private async cachedUser(
    userId: string,
  ): Promise<{ id: string; locale: 'en' | 'hi' | 'mr' } | null> {
    const key = `user:${userId}`;
    const hit = this.cache.get<{ id: string; locale: 'en' | 'hi' | 'mr' } | null>(key);
    if (hit !== undefined) return hit;
    const user = await this.users.findActiveById(userId);
    const value = user ? { id: user.id, locale: user.locale } : null;
    this.cache.set(key, value, USER_TTL_MS);
    return value;
  }
}

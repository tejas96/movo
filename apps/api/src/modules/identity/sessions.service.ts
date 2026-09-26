import type { AuthTokens } from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { JwtService } from '../../common/auth/jwt.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { getStore } from '../../common/request-store';
import { TtlCache } from '../../common/tenant/tenant-cache';
import { secureToken } from '../../common/util/codes';
import { addMs, days } from '../../common/util/dates';
import { sha256 } from '../../common/util/hash';
import { newId } from '../../common/util/ids';
import { loadEnv } from '../../config/env';

export interface DeviceInfo {
  deviceName?: string | undefined;
  platform?: string | undefined;
}

const SESSION_CACHE_MS = 60_000;

/**
 * Refresh tokens: opaque, hashed at rest, rotated on every use. Presenting a token that was
 * already rotated revokes the whole family (theft detection).
 */
@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly cache: TtlCache,
  ) {}

  async issue(
    userId: string,
    device: DeviceInfo = {},
    familyId: string = newId(),
  ): Promise<AuthTokens> {
    const refreshToken = secureToken();
    const refreshExpiresAt = addMs(new Date(), days(loadEnv().REFRESH_TOKEN_TTL_DAYS));
    const session = await this.prisma.refreshSession.create({
      data: {
        userId,
        tokenHash: sha256(refreshToken),
        familyId,
        deviceName: device.deviceName ?? null,
        platform: device.platform ?? null,
        ip: getStore()?.ip ?? null,
        expiresAt: refreshExpiresAt,
      },
    });
    const access = await this.jwt.sign({ sub: userId, sid: session.id });
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken,
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
    };
  }

  async rotate(refreshToken: string): Promise<AuthTokens> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: sha256(refreshToken) },
    });
    if (!session) throw ApiException.badRequest('TOKEN_INVALID', 'Refresh token is not valid');
    if (session.revokedAt) {
      // Reuse of a rotated token: someone else has it. Kill the family.
      await this.prisma.refreshSession.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.cache.deleteByPrefix(`session:`);
      throw ApiException.badRequest('TOKEN_INVALID', 'Refresh token was already used');
    }
    if (session.expiresAt < new Date())
      throw ApiException.badRequest('TOKEN_INVALID', 'Refresh token expired');
    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (user?.status !== 'ACTIVE')
      throw ApiException.badRequest('TOKEN_INVALID', 'Account is not active');

    const tokens = await this.issue(
      session.userId,
      { deviceName: session.deviceName ?? undefined, platform: session.platform ?? undefined },
      session.familyId,
    );
    const replacement = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: sha256(tokens.refreshToken) },
    });
    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: {
        revokedAt: new Date(),
        replacedById: replacement?.id ?? null,
        lastUsedAt: new Date(),
      },
    });
    this.cache.delete(`session:${session.id}`);
    return tokens;
  }

  async revokeByToken(refreshToken: string): Promise<void> {
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash: sha256(refreshToken) },
    });
    if (session && !session.revokedAt) {
      await this.prisma.refreshSession.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      this.cache.delete(`session:${session.id}`);
    }
  }

  async revokeById(sessionId: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.cache.delete(`session:${sessionId}`);
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string): Promise<void> {
    await this.prisma.refreshSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    this.cache.deleteByPrefix('session:');
  }

  /** Access tokens are short-lived, but logout and deletion must bite at once. Cached for a minute. */
  async isSessionLive(sessionId: string): Promise<boolean> {
    const key = `session:${sessionId}`;
    const cached = this.cache.get<boolean>(key);
    if (cached !== undefined) return cached;
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: sessionId },
      select: { revokedAt: true, familyId: true },
    });
    // The session row itself is rotated on refresh, so accept any live row of the same family.
    let live = Boolean(session && !session.revokedAt);
    if (session && !live) {
      const sibling = await this.prisma.refreshSession.findFirst({
        where: { familyId: session.familyId, revokedAt: null },
      });
      live = Boolean(sibling);
    }
    this.cache.set(key, live, SESSION_CACHE_MS);
    return live;
  }
}

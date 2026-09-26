import type { Locale, User as UserDto } from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { DevicePlatform } from '../../generated/prisma/client';
import { UsersService } from './users.service';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async get(userId: string): Promise<UserDto> {
    const user = await this.users.findActiveById(userId);
    if (!user) throw ApiException.unauthenticated();
    return this.users.toDto(user);
  }

  async update(
    userId: string,
    patch: { displayName?: string | undefined; locale?: Locale | undefined },
  ): Promise<UserDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(patch.displayName ? { displayName: patch.displayName } : {}),
        ...(patch.locale ? { locale: patch.locale } : {}),
      },
    });
    return this.users.toDto(user);
  }

  async registerDevice(
    userId: string,
    token: string,
    platform: DevicePlatform,
    appVersion?: string,
  ): Promise<void> {
    await this.prisma.deviceToken.upsert({
      where: { token },
      update: { userId, platform, appVersion: appVersion ?? null, lastSeenAt: new Date() },
      create: { userId, token, platform, appVersion: appVersion ?? null },
    });
  }

  async removeDevice(userId: string, token: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({ where: { userId, token } });
  }
}

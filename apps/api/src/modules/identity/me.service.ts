import type { Locale, User as UserDto } from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { DevicePlatform } from '../../generated/prisma/client';
import { FilesService, type UploadedBlob } from '../files/files.service';
import { UsersService } from './users.service';

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly files: FilesService,
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

  /** New photo first, then the old one goes. */
  async setAvatar(userId: string, file: UploadedBlob | undefined): Promise<UserDto> {
    const before = await this.users.findActiveById(userId);
    if (!before) throw ApiException.unauthenticated();
    const fileId = await this.files.uploadAvatar(file);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarFileId: fileId },
    });
    if (before.avatarFileId) await this.files.remove([before.avatarFileId]);
    return this.users.toDto(user);
  }

  async removeAvatar(userId: string): Promise<UserDto> {
    const before = await this.users.findActiveById(userId);
    if (!before) throw ApiException.unauthenticated();
    if (!before.avatarFileId) return this.users.toDto(before);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarFileId: null },
    });
    await this.files.remove([before.avatarFileId]);
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

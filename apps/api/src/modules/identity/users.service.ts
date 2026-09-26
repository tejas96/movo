import type { User as UserDto } from '@movo/contracts';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { type Identifier, normalizeIdentifier } from '../../common/util/identifier';
import type { User } from '../../generated/prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  toDto(user: User): UserDto {
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone,
      locale: user.locale,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
    };
  }

  parseIdentifier(raw: string): Identifier | null {
    return normalizeIdentifier(raw);
  }

  async findByIdentifier(identifier: Identifier): Promise<User | null> {
    return identifier.kind === 'email'
      ? this.prisma.user.findUnique({ where: { email: identifier.value } })
      : this.prisma.user.findUnique({ where: { phone: identifier.value } });
  }

  async findActiveById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user && user.status === 'ACTIVE' ? user : null;
  }
}

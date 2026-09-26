import type { AuthSession, AuthTokens, Locale } from '@movo/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { ApiException } from '../../common/errors/api.exception';
import { PrismaService } from '../../common/prisma/prisma.service';
import { numericCode, secureToken } from '../../common/util/codes';
import { addMs, minutes } from '../../common/util/dates';
import { sha256 } from '../../common/util/hash';
import { loadEnv } from '../../config/env';
import { EmailService } from './email.service';
import { PasswordService } from './password.service';
import { type DeviceInfo, SessionsService } from './sessions.service';
import { UsersService } from './users.service';

const MAX_FAILED = 10;
const LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly email: EmailService,
    private readonly audit: AuditService,
  ) {}

  async register(input: {
    identifier: string;
    password: string;
    displayName: string;
    locale: Locale;
    device?: DeviceInfo | undefined;
  }): Promise<AuthSession> {
    const id = this.users.parseIdentifier(input.identifier);
    if (!id)
      throw ApiException.badRequest('VALIDATION_FAILED', 'Enter a valid mobile number or email', [
        { path: ['identifier'], message: 'invalid' },
      ]);
    if (this.passwords.isTooCommon(input.password)) {
      throw ApiException.badRequest('VALIDATION_FAILED', 'That password is too common', [
        { path: ['password'], message: 'too_common' },
      ]);
    }
    const existing = await this.users.findByIdentifier(id);
    if (existing)
      throw ApiException.conflict(
        'IDENTIFIER_TAKEN',
        'An account with this number or email already exists',
      );

    const hash = await this.passwords.hash(input.password);
    const user = await this.prisma.user.create({
      data: {
        email: id.kind === 'email' ? id.value : null,
        phone: id.kind === 'phone' ? id.value : null,
        displayName: input.displayName,
        locale: input.locale,
        credentials: { create: { type: 'PASSWORD', secretHash: hash } },
      },
    });
    const tokens = await this.sessions.issue(user.id, input.device);
    return { tokens, user: this.users.toDto(user) };
  }

  async login(input: {
    identifier: string;
    password: string;
    device?: DeviceInfo | undefined;
  }): Promise<AuthSession> {
    const id = this.users.parseIdentifier(input.identifier);
    const user = id ? await this.users.findByIdentifier(id) : null;
    const credential = user
      ? await this.prisma.userCredential.findUnique({
          where: { userId_type: { userId: user.id, type: 'PASSWORD' } },
        })
      : null;

    if (user?.status !== 'ACTIVE' || !credential?.secretHash) {
      // Same cost path as a wrong password so timing does not reveal accounts.
      await this.passwords.hash(input.password);
      throw ApiException.badRequest(
        'INVALID_CREDENTIALS',
        'Wrong mobile number, email or password',
      );
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ApiException('ACCOUNT_LOCKED', 'Too many failed attempts. Try again later.', 423);
    }
    const ok = await this.passwords.verify(credential.secretHash, input.password);
    if (!ok) {
      const failed = user.failedLoginCount + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: failed,
          lockedUntil: failed >= MAX_FAILED ? addMs(new Date(), minutes(LOCK_MINUTES)) : null,
        },
      });
      throw ApiException.badRequest(
        'INVALID_CREDENTIALS',
        'Wrong mobile number, email or password',
      );
    }
    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      });
    }
    const tokens = await this.sessions.issue(user.id, input.device);
    return { tokens, user: this.users.toDto(user) };
  }

  refresh(refreshToken: string): Promise<AuthTokens> {
    return this.sessions.rotate(refreshToken);
  }

  async logout(sessionId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) await this.sessions.revokeByToken(refreshToken);
    await this.sessions.revokeById(sessionId);
  }

  /** Always resolves. Sends only when the account exists and has an email. */
  async forgotPassword(identifier: string): Promise<void> {
    const id = this.users.parseIdentifier(identifier);
    const user = id ? await this.users.findByIdentifier(id) : null;
    if (user?.status !== 'ACTIVE' || !user.email) return;
    const token = secureToken(32);
    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        codeHash: sha256(token),
        kind: 'EMAIL_LINK',
        expiresAt: addMs(new Date(), minutes(15)),
      },
    });
    const link = `${loadEnv().APP_BASE_URL}reset-password?identifier=${encodeURIComponent(user.email)}&code=${token}`;
    await this.email.send({
      to: user.email,
      subject: 'Reset your MOVO password',
      text: `Hello ${user.displayName},\n\nTap the link to set a new password. It works once and expires in 15 minutes.\n\n${link}\n\nIf you did not ask for this, ignore this email.`,
    });
  }

  /** Admin-issued numeric code for members without email. Returned once to the admin. */
  async issueAdminResetCode(
    userId: string,
    issuedByUserId: string,
  ): Promise<{ code: string; expiresAt: Date }> {
    const code = numericCode(8);
    const expiresAt = addMs(new Date(), minutes(15));
    await this.prisma.passwordReset.create({
      data: { userId, codeHash: sha256(code), kind: 'ADMIN_CODE', issuedByUserId, expiresAt },
    });
    return { code, expiresAt };
  }

  async resetPassword(input: {
    identifier: string;
    code: string;
    newPassword: string;
  }): Promise<void> {
    const id = this.users.parseIdentifier(input.identifier);
    const user = id ? await this.users.findByIdentifier(id) : null;
    const reset = user
      ? await this.prisma.passwordReset.findFirst({
          where: {
            userId: user.id,
            codeHash: sha256(input.code),
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
        })
      : null;
    if (!user || !reset)
      throw ApiException.badRequest(
        'RESET_CODE_INVALID',
        'This reset code is not valid or has expired',
      );
    if (this.passwords.isTooCommon(input.newPassword)) {
      throw ApiException.badRequest('VALIDATION_FAILED', 'That password is too common', [
        { path: ['newPassword'], message: 'too_common' },
      ]);
    }
    const hash = await this.passwords.hash(input.newPassword);
    await this.prisma.$transaction([
      this.prisma.passwordReset.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      this.prisma.userCredential.upsert({
        where: { userId_type: { userId: user.id, type: 'PASSWORD' } },
        update: { secretHash: hash },
        create: { userId: user.id, type: 'PASSWORD', secretHash: hash },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null },
      }),
    ]);
    await this.sessions.revokeAllForUser(user.id);
    this.logger.log(`Password reset for user ${user.id} via ${reset.kind}`);
  }

  async changePassword(
    userId: string,
    sessionId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const credential = await this.prisma.userCredential.findUnique({
      where: { userId_type: { userId, type: 'PASSWORD' } },
    });
    const ok = credential?.secretHash
      ? await this.passwords.verify(credential.secretHash, currentPassword)
      : false;
    if (!ok) throw ApiException.badRequest('PASSWORD_INCORRECT', 'The current password is wrong');
    if (this.passwords.isTooCommon(newPassword)) {
      throw ApiException.badRequest('VALIDATION_FAILED', 'That password is too common', [
        { path: ['newPassword'], message: 'too_common' },
      ]);
    }
    await this.prisma.userCredential.update({
      where: { userId_type: { userId, type: 'PASSWORD' } },
      data: { secretHash: await this.passwords.hash(newPassword) },
    });
    await this.sessions.revokeAllForUser(userId, sessionId);
  }

  /** Google Play requires in-app deletion. Personal fields go, society records keep an anonymous reference. */
  async deleteAccount(userId: string, password: string): Promise<void> {
    const credential = await this.prisma.userCredential.findUnique({
      where: { userId_type: { userId, type: 'PASSWORD' } },
    });
    const ok = credential?.secretHash
      ? await this.passwords.verify(credential.secretHash, password)
      : false;
    if (!ok) throw ApiException.badRequest('PASSWORD_INCORRECT', 'The password is wrong');
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          status: 'DELETED',
          deletedAt: new Date(),
          email: null,
          phone: null,
          displayName: 'Deleted member',
          avatarUrl: null,
        },
      });
      await tx.userCredential.deleteMany({ where: { userId } });
      await tx.deviceToken.deleteMany({ where: { userId } });
      await tx.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.membership.updateMany({
        where: { userId, status: { in: ['ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL', 'INVITED'] } },
        data: { status: 'LEFT', leftAt: new Date() },
      });
      await tx.joinRequest.updateMany({
        where: { userId, status: 'PENDING' },
        data: { status: 'REJECTED', decisionReason: 'account deleted' },
      });
      await this.audit.record({ action: 'user.deleted', entityType: 'User', entityId: userId }, tx);
    });
    await this.sessions.revokeAllForUser(userId);
  }
}

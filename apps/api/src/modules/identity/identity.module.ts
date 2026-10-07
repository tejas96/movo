import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service';
import { JwtService } from '../../common/auth/jwt.service';
import { TtlCache } from '../../common/tenant/tenant-cache';
import { FilesModule } from '../files/files.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { PasswordService } from './password.service';
import { SessionsService } from './sessions.service';
import { UsersService } from './users.service';

@Module({
  imports: [FilesModule],
  controllers: [AuthController, MeController],
  providers: [
    AuthService,
    UsersService,
    PasswordService,
    SessionsService,
    EmailService,
    MeService,
    JwtService,
    TtlCache,
    AuditService,
  ],
  exports: [AuthService, UsersService, SessionsService, PasswordService, JwtService, TtlCache],
})
export class IdentityModule {}

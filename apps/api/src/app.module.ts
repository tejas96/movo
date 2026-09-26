import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ApiExceptionFilter } from './common/errors/api-exception.filter';
import { PrismaModule } from './common/prisma/prisma.module';
import { getStore } from './common/request-store';
import { ResponseValidationInterceptor } from './common/route/response-validation.interceptor';
import { RouteGuard } from './common/route/route.guard';
import { loadEnv } from './config/env';
import { AppController } from './modules/app/app.controller';
import { EmergencyModule } from './modules/emergency/emergency.module';
import { EventsModule } from './modules/events/events.module';
import { HomeModule } from './modules/home/home.module';
import { IdentityModule } from './modules/identity/identity.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { NoticesModule } from './modules/notices/notices.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ParkingModule } from './modules/parking/parking.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { VendorsModule } from './modules/vendors/vendors.module';

const env = loadEnv();

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        genReqId: (req) =>
          getStore()?.requestId ?? String(req.headers['x-request-id'] ?? 'no-request-id'),
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        autoLogging: env.NODE_ENV !== 'test',
        ...(env.NODE_ENV === 'development'
          ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
          : {}),
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      skipIf: () => env.NODE_ENV === 'test',
    }),
    ...(env.NODE_ENV === 'test' ? [] : [ScheduleModule.forRoot()]),
    PrismaModule,
    IdentityModule,
    NotificationsModule,
    TenancyModule,
    NoticesModule,
    ParkingModule,
    VendorsModule,
    EmergencyModule,
    MeetingsModule,
    EventsModule,
    RemindersModule,
    HomeModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: RouteGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseValidationInterceptor },
  ],
})
export class AppModule {}

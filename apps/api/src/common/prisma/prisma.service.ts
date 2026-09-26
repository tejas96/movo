import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { loadEnv } from '../../config/env';
import { PrismaClient } from '../../generated/prisma/client';

/**
 * Platform-scoped client. Use it only in identity, platform, join, context and background jobs.
 * Tenant modules use TenantPrismaService, which refuses to run without a tenant context.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({ connectionString: loadEnv().DATABASE_URL });
    super({ adapter, log: loadEnv().NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

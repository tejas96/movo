import type { AttentionItem, HomeSummary, ModuleKey, UpcomingItem } from '@movo/contracts';
import { Global, Injectable, Module } from '@nestjs/common';
import type { TenantContext } from '../tenant/tenant.types';

/** What one module adds to Home. Every field is optional. */
export interface HomePart {
  attention?: AttentionItem[];
  upcoming?: UpcomingItem[];
  notices?: HomeSummary['notices'];
  /** Reward points this year (rewards module). */
  points?: number;
  /** My tasks in progress or waiting for a check (tasks module). */
  openTasks?: number;
}

export interface HomeSection {
  /** Module that must be switched on for this society, or null for a core section. */
  module: ModuleKey | null;
  /**
   * Position of this section's attention items (and upcoming items with the same start):
   * lower comes first. See HOME_ORDER.
   */
  order: number;
  load(ctx: TenantContext, now: Date): Promise<HomePart>;
}

/**
 * Where each module's part goes on Home. Alerts first, then important notices, then money
 * owed, my duty, my tasks, then admin items; the profile reminder last.
 */
export const HOME_ORDER = {
  emergency: 10,
  notices: 20,
  maintenance: 100,
  duties: 200,
  tasks: 300,
  marketplace: 400,
  members: 500,
  expenses: 600,
  vendors: 700,
  meetings: 800,
  events: 810,
  rewards: 900,
  profile: 1000,
} as const;

/**
 * Home sections. Each feature module registers its part in onModuleInit, so Home does not
 * import every module and a new module adds its home part without editing Home.
 */
@Injectable()
export class HomeRegistry {
  private readonly sections: HomeSection[] = [];

  register(section: HomeSection): void {
    this.sections.push(section);
    this.sections.sort((a, b) => a.order - b.order);
  }

  /** Sections switched on for this society, in Home order. */
  activeFor(ctx: TenantContext): readonly HomeSection[] {
    return this.sections.filter((s) => s.module === null || ctx.enabledModules.has(s.module));
  }
}

@Global()
@Module({ providers: [HomeRegistry], exports: [HomeRegistry] })
export class HomeRegistryModule {}

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TENANT_MODELS } from './tenant-prisma.service';

/**
 * Models with a societyId that are deliberately not filtered by the tenant client. Each needs
 * a reason; everything else with a societyId must be in TENANT_MODELS.
 */
const NOT_FILTERED: Record<string, string> = {
  Notification: 'Owned by a user; societyId only says where it came from.',
  NotificationPreference: 'Owned by a user and read by userId.',
  AuditLog: 'societyId is null for platform actions; the audit list filters by society itself.',
};

function modelsWithSocietyId(): string[] {
  const schema = readFileSync(resolve(__dirname, '../../../prisma/schema.prisma'), 'utf8');
  return [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)]
    .filter(([, , body]) => /^\s+societyId\s/m.test(body ?? ''))
    .map(([, name]) => name as string);
}

describe('TENANT_MODELS', () => {
  it('lists every model that has a societyId', () => {
    const missing = modelsWithSocietyId().filter((m) => !TENANT_MODELS.has(m) && !NOT_FILTERED[m]);
    expect(missing, 'add these to TENANT_MODELS or to NOT_FILTERED with a reason').toEqual([]);
  });
  it('lists no model without a societyId', () => {
    const real = new Set(modelsWithSocietyId());
    expect([...TENANT_MODELS].filter((m) => !real.has(m))).toEqual([]);
  });
});

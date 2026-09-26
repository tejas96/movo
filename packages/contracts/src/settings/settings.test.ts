import { describe, expect, it } from 'vitest';
import { MODULE_KEYS, PERMISSION_KEYS, ROLE_TEMPLATE_PERMISSIONS } from '../core/enums';
import { DEFAULT_MODULE_ENABLED, moduleSettingsSchemas, parseModuleSettings } from './index';

describe('module settings', () => {
  it('has a schema and a default switch for every module', () => {
    for (const key of MODULE_KEYS) {
      expect(moduleSettingsSchemas[key]).toBeDefined();
      expect(typeof DEFAULT_MODULE_ENABLED[key]).toBe('boolean');
    }
  });
  it('parses empty settings into defaults', () => {
    expect(parseModuleSettings('maintenance', undefined).transparency).toBe('STATUS');
    expect(parseModuleSettings('rewards', {}).dutiesEarnPoints).toBe(false);
    expect(parseModuleSettings('expenses', { approval: 'ALWAYS' }).approvalThresholdPaise).toBe(
      500_000,
    );
  });
  it('role templates only use known permissions', () => {
    for (const perms of Object.values(ROLE_TEMPLATE_PERMISSIONS)) {
      for (const p of perms) expect(PERMISSION_KEYS).toContain(p);
    }
  });
});

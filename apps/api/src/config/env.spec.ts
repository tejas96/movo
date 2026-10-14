import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

const base = { DATABASE_URL: 'postgresql://x', JWT_SECRET: 'j'.repeat(32) };

describe('FILES_URL_SECRET', () => {
  it('is optional: missing or empty means photo links stay signed with JWT_SECRET', () => {
    expect(parseEnv(base).FILES_URL_SECRET).toBe('');
    expect(parseEnv({ ...base, FILES_URL_SECRET: '' }).FILES_URL_SECRET).toBe('');
  });
  it('needs 32 characters when set', () => {
    expect(() => parseEnv({ ...base, FILES_URL_SECRET: 'short' })).toThrow(/FILES_URL_SECRET/);
    expect(parseEnv({ ...base, FILES_URL_SECRET: 'f'.repeat(32) }).FILES_URL_SECRET).toBe(
      'f'.repeat(32),
    );
  });
});

import { describe, expect, it } from 'vitest';
import { matchesAudience } from './audience';

const viewer = { roleIds: ['r1'], flatIds: ['f1', 'f2'], buildingIds: ['b1'] };

describe('matchesAudience', () => {
  it('ALL matches everyone', () => {
    expect(matchesAudience({ type: 'ALL' }, viewer)).toBe(true);
  });
  it('matches by role, building, flat', () => {
    expect(matchesAudience({ type: 'ROLES', ids: ['r1'] }, viewer)).toBe(true);
    expect(matchesAudience({ type: 'ROLES', ids: ['r9'] }, viewer)).toBe(false);
    expect(matchesAudience({ type: 'BUILDINGS', ids: ['b1'] }, viewer)).toBe(true);
    expect(matchesAudience({ type: 'FLATS', ids: ['f2'] }, viewer)).toBe(true);
    expect(matchesAudience({ type: 'FLATS', ids: ['f3'] }, viewer)).toBe(false);
  });
});

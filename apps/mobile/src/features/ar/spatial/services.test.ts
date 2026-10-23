import { describe, expect, it } from 'vitest';
import { levelById } from './model';
import { H, servicesOnLevel } from './services';

describe('servicesOnLevel', () => {
  const L1 = levelById('L1');
  const L0 = levelById('L0');
  it('gives every wet room a supply and a drain on a typical floor', () => {
    if (!L1) throw new Error('L1 missing');
    const s = servicesOnLevel(L1);
    const water = s.lines.filter((l) => l.kind === 'water' && l.flat);
    const drain = s.lines.filter((l) => l.kind === 'drain' && l.flat);
    // 5 kitchens + 7 toilets on the typical floor; 29 rooms get a conduit (living, kitchen, bedroom, toilet, passage, unlabeled)
    expect(water.length).toBe(12);
    expect(drain.length).toBe(12);
    expect(s.markers.filter((m) => m.kind === 'sink').length).toBe(5);
    expect(s.markers.filter((m) => m.kind === 'basin').length).toBe(7);
  });
  it('gives every flat one distribution board and a conduit per room', () => {
    if (!L1) throw new Error('L1 missing');
    const s = servicesOnLevel(L1);
    const dbs = s.markers.filter((m) => m.kind === 'db');
    expect(dbs.map((d) => d.flat).sort()).toEqual(['101', '102', '103', '104', '105']);
    expect(s.lines.filter((l) => l.kind === 'electric' && l.id.endsWith('/CONDUIT')).length).toBe(
      29,
    );
    expect(s.markers.filter((m) => m.kind === 'switchboard').length).toBe(20);
  });
  it('keeps every point inside the level slab-to-ceiling band', () => {
    if (!L1) throw new Error('L1 missing');
    const s = servicesOnLevel(L1);
    for (const l of s.lines)
      for (const p of l.points) {
        expect(p[2]).toBeGreaterThanOrEqual(L1.elevationMm + H.drainRun - 50);
        expect(p[2]).toBeLessThanOrEqual(L1.elevationMm + H.ceiling);
      }
  });
  it('marks everything inferred and uses instance codes', () => {
    if (!L1) throw new Error('L1 missing');
    const s = servicesOnLevel(L1);
    expect(s.lines.every((l) => l.confidence === 'inferred')).toBe(true);
    expect(s.lines.some((l) => l.id.startsWith('B1/L1/F103/KITCHEN'))).toBe(true);
    expect(s.lines.some((l) => l.id.includes('/TYP/'))).toBe(false);
  });
  it('still has risers on the ground floor, which has no shaft polygons', () => {
    if (!L0) throw new Error('L0 missing');
    const s = servicesOnLevel(L0);
    expect(s.lines.filter((l) => l.id.endsWith('WATER_RISER')).length).toBe(2);
    expect(s.lines.filter((l) => l.id.endsWith('ELECTRIC_RISER')).length).toBe(1);
    expect(s.markers.filter((m) => m.kind === 'db').length).toBe(0);
  });
});

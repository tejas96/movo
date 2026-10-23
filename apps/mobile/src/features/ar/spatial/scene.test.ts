import { describe, expect, it } from 'vitest';
import { levelById, model } from './model';
import { buildLevelScene, buildRouteScene, DEFAULT_LAYERS, sceneJson } from './scene';
import { servicesOnLevel } from './services';

describe('scene', () => {
  const L1 = levelById('L1');
  it('draws only the layers that are on', () => {
    if (!L1) throw new Error('L1 missing');
    const sv = servicesOnLevel(L1);
    const off = buildLevelScene(L1, DEFAULT_LAYERS, sv);
    expect(off.meshes.length).toBe(0);
    expect(off.labels.length).toBeGreaterThan(30);
    const on = buildLevelScene(
      L1,
      { ...DEFAULT_LAYERS, water: true, electric: true, rooms: false },
      sv,
    );
    const ids = on.meshes.map((m) => m.id);
    expect(ids).toContain('L1/water');
    expect(ids).toContain('L1/electric');
    expect(ids).not.toContain('L1/drain');
    expect(on.labels.every((l) => l.kind === 'marker')).toBe(true);
    // metres, not millimetres
    expect(Math.abs(on.meshes[0]?.positions[2] ?? 0)).toBeLessThan(30);
  });
  it('shows only the focus flat plus the shared risers', () => {
    if (!L1) throw new Error('L1 missing');
    const sv = servicesOnLevel(L1);
    const all = buildLevelScene(L1, { ...DEFAULT_LAYERS, electric: true }, sv, '103');
    const electric = all.meshes.find((m) => m.id === 'L1/electric');
    expect(electric).toBeDefined();
    // 7 rooms of flat 103 + its feed + one riser: 9 tubes of 6 sides; nothing from the other flats
    const lines103 = sv.lines.filter(
      (l) => l.kind === 'electric' && (l.flat === '103' || l.flat === null),
    );
    const verts = lines103.reduce((n, l) => n + l.points.length * 6, 0);
    expect((electric?.positions.length ?? 0) / 3).toBe(verts);
    // riser labels belong to the water layer, which is off here
    expect(all.labels.filter((l) => l.kind === 'marker').map((l) => l.text)).toEqual(['DB 103']);
    const common = buildLevelScene(L1, { ...DEFAULT_LAYERS, electric: true }, sv, null);
    expect(common.labels.filter((l) => l.text.startsWith('DB')).length).toBe(0);
  });
  it('keeps the level JSON under 400 KB with every layer on', () => {
    if (!L1) throw new Error('L1 missing');
    const sv = servicesOnLevel(L1);
    const all = buildLevelScene(
      L1,
      { ...DEFAULT_LAYERS, water: true, drain: true, electric: true },
      sv,
    );
    expect(sceneJson(all).length).toBeLessThan(400_000);
  });
  it('builds a ribbon and a pin for a destination on the level', () => {
    if (!L1) throw new Error('L1 missing');
    const dest = model.building.nav.nodes.find((n) => n.id === 'n_L1_sp_f104_kitchen') ?? null;
    const lift =
      model.building.nav.nodes.find((n) => n.levelId === 'L1' && n.kind === 'lift') ?? null;
    expect(dest && lift).toBeTruthy();
    if (!dest || !lift) return;
    const nodes = [lift, dest];
    const routeView = {
      route: { nodes, totalS: 10, totalMm: 8000 },
      points: nodes.map((n) => [n.p[0], n.p[1], L1.elevationMm + 100] as [number, number, number]),
      next: dest,
    };
    const s = buildRouteScene(routeView, dest, L1);
    expect(s.meshes.map((m) => m.id)).toEqual(['route', 'dest-ring', 'dest-pin']);
    expect(s.labels[0]?.kind).toBe('dest');
    expect(buildRouteScene(null, null, L1).meshes.length).toBe(0);
  });
});

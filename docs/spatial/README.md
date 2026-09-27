# Spatial model files

Phase 1 output for [docs/09-spatial-ar-digital-twin.md](../09-spatial-ar-digital-twin.md). Data only. No app code.

| File | What it is |
| --- | --- |
| `laxmi-pushp.building.json` | building.json v0.1. Frame, levels, world link, and three templates: `TYP` (floors 1 to 5), `SIXTH` (floor 6), `GF` (ground). |
| `typical-floor-v0.png` | Check picture, typical floor. Metres, origin at the lift shaft. |
| `sixth-floor-v0.png` | Check picture, sixth floor. |
| `ground-floor-v0.png` | Check picture, ground floor with plot edge, shops, parking slots, entries. |
| `laxmi-pushp.glb` | Phase 2. 3D model of all 7 levels, 915 objects. Each node is named by its instance code (for example `B1/L3/F301/KITCHEN`) and carries the same fields as the JSON in `extras`. Metres, Z up, same origin. |
| `viewer.html` | Phase 2. Single-file 3D check page. Open it in a browser (no server needed; loads three.js from a CDN). Level toggles, explode slider, click any object for its code, walking graph, route test. |
| `plates/` | Phase 3. The 12 landmark plates: print PDFs, reference images, registry. See its README. |
| `tools/` | The throw-away scripts that made the files. Not app code. See "How to re-run". |

Coordinates are millimetres in the building frame (BLCS): origin at the outer south-west corner of the lift shaft wall, +X plan east, +Y plan north.

## What is in v0.1

| Template | Content | Trust |
| --- | --- | --- |
| TYP | 41 columns with footprints; lift (outer, inner, west door 1.0 m); stair (U around the lift); lobby, ventilation shaft, small shaft, duct; 42 rooms with polygons; 5 flat outlines; 231 wall openings (24 doors, 4 windows, rest unsorted) | Columns, lift, shafts, lobby: high (1:75 CAD vectors). Living rooms, kitchens, bedrooms: high. Toilets: medium, outlines from the brochure blue fill. Flat outlines: medium, hand-drawn, 7–14 % over RERA carpet. Openings: low. |
| SIXTH | Core copied from TYP; flats 601 and 602 outlines; rooms copied from positions 02 and 03; terraces and balconies from the brochure green fill; 602 kitchen as a hand rectangle | 601 outline within 1 % of RERA carpet, 602 within 9 %. Terraces: medium. |
| GF | Plot boundary; 4 shops from the brochure purple fill; entrance lobby; parking floor polygon; 17 car slots from the car icons; 3 two-wheeler areas; 3 entries; lift, stair and columns copied from TYP; common toilet placeholder | Shops within 3.5 % of RERA carpet. Slots assume 2.5 × 4.5 m. Plot corners ±0.3 m. Lobby and toilet: low. |

Still missing: fixtures (blue plumbing symbols), switch boards (electrical drawings), wall polygons as objects, door swing direction, roof, tank and pump positions, any height (all ASSUMED, see docs/09 section 1.10).

## Phase 2 in the JSON (schema 0.3)

- `instances`: one record per 3D object with its per-level code. Flat codes follow the floor: position 03 on level 4 is `F403`.
- `nav`: the walking graph. 340 nodes (one per walkable space, one per detected door, lift door and two stair entries per level, entries and slots on the ground floor) and 326 edges. Lift between floors costs 40 s, stair 25 s. `walk_fallback` edges (79) join rooms where no door was detected; verify those.
- 3D rules: room floor plates 20 mm, walls 100 mm thick along each room edge up to the level height minus the slab, columns full height, lift shaft walls with the west door cut, stair shown as a half-height block, doors as 2.1 m frames. All heights ASSUMED (docs/09 section 1.10).

## Fit of the brochure pictures

The brochure plans are pictures, not CAD. Each was fitted on the lift shaft inner box (1.877 × 1.625 m from the CAD):

| Plan | Scale | Origin pixel | Check |
| --- | --- | --- | --- |
| Ground floor (page 4) | 52.2 px/m | (1707, 702) | shop areas within 3.5 % of RERA |
| First floor (page 5) | 76.0 px/m | (1615.5, 719.5) | flat 04 outline within 40 mm of the CAD in x |
| Sixth floor (page 8) | 76.0 px/m | (1610.4, 714.6) | flat 601 within 1 % of RERA |

## How it was made

1. `svgplan.py`: `pdftocairo -svg` of the plumbing PDF, then parse every `<path>` into line pieces in mm. Scale 1:75 on A3 gives 1 pt = 26.458 mm.
2. `columns.py`: cluster the green label strokes into 41 labels and render a contact sheet; the label texts were read once and stored in `labels_raw.json` order inside `mask3.py`.
3. `mask3.py`: draw wall hatch bands into a 20 mm raster (face lines are not walls: dimension lines share their style), make walls solid with a 7×7 closing, fill door and window gaps (free runs bounded by wall on both sides, 4–22 rows deep, tracked by overlap), flood-fill free space into regions.
4. `trace.py`: trace each region into a rectilinear polygon, bridge pieces of one room, grow 40 mm to the wall face.
5. `build_building.py`: seed points per room, flat outlines, lift, stair, assembly, overlay.
6. `raster_floor.py`: brochure image → colour classes → regions → polygons in BLCS, using the lift-shaft fit.
7. `build_extra.py`: adds `SIXTH` and `GF`, backfills TYP toilets from the first-floor blue fill, draws the two overlays.
8. `build_3d.py`: instantiates levels, extrudes to 3D, writes the `.glb` (own minimal glTF writer, no dependencies) and the `nav` graph.
9. `make_viewer.py`: inlines the `.glb`, the graph and the levels into `viewer.html` from `viewer_template.html`.
10. `make_plates.py`: generates the plates, `plates.json`, and the app module `apps/mobile/src/features/ar/plates.generated.ts`. The app also carries a copy of `laxmi-pushp.building.json` at `apps/mobile/src/features/ar/data/building.json`; copy it again after any rebuild.

## How to re-run

```bash
pdftocairo -svg "24_Typical Floor Plumbing Layout-For Review.pdf" plumbing.svg
pdfimages -png -f 4 -l 8 "Floor Plans_Laxmi-Pushp.pdf" bro/p
python3 tools/svgplan.py && python3 tools/columns.py && python3 tools/mask3.py && python3 tools/build_building.py
python3 tools/raster_floor.py f1 && python3 tools/raster_floor.py f6 && python3 tools/raster_floor.py gf && python3 tools/build_extra.py
python3 tools/build_3d.py && python3 tools/make_viewer.py
```

To view: open `viewer.html` directly, or run the `spatial-viewer` entry in `.claude/launch.json` (serves this folder on port 8765).

Paths inside the scripts point at a scratch directory. Change `S` at the top of each script first. `raster_floor.py` takes a few minutes per plan.

## Gaps to close next

- Stair as real flights and landings, not a block. Wall thickness from the CAD instead of a fixed 100 mm.
- Route inside a room around furniture is not modelled; edges are straight lines between centroids and doors.

- Sort the 203 unsorted openings; add door swing from the arcs.
- Fixtures from the blue plumbing symbols; switch boards from the electrical drawings by offset from a wall.
- Roof: tank, pump, lift machine room, solar. Needs a photo or a site walk.
- Confirm on site which balcony variant the CAD typical floor shows, and the assumed heights.

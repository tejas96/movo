# Spatial model, AR and Digital Twin: foundation

Status: **analysis + Phase 1 data**. No production code. Date: 2026-09-27.
Phase 1 and Phase 2 output: [docs/spatial/](spatial/README.md) holds `building.json` (all floors), the 3D model `laxmi-pushp.glb`, the walking graph, and `viewer.html` to check them.

Source: 7 drawing PDFs for **'Laxmi-Pushp' Apartment**, Swapna-Nagari, Vishrambaug, Sangli.
Architect: Shantanu Paranjape (ASP). Developer: Joshi Paranjape Developers.

Status words follow [docs/README.md](README.md): DECIDED, PROPOSED, OPEN, LATER.
Two extra words are used here for facts about the building:

- **UNKNOWN**: the drawings do not say. Nobody should guess it.
- **REQUIRES_HUMAN_VALIDATION**: the drawings say it, but a person must confirm it on site.
- **REQUIRES_MEASUREMENT**: a person must measure it on site.

The goal in one line:

```
Drawings  →  building.json (one coordinate frame)  →  3D per level  →  phone pose in that frame
          →  AR content at real places  →  IoT state on the same objects  →  Digital Twin
```

---

## 0. Summary

**What we have.** Good 2D plans for every floor type, one scaled CAD plumbing drawing (1:75, vector, measurable),
five per-flat electrical layouts with switch-board positions and heights, and a rendered elevation picture.

**What we do not have.** No 3D model file (only a picture). No floor heights. No sections. No site survey
coordinates. No roof, tank, pump room, meter room or fire drawings. No pipe or conduit routes.
The architect has sent everything they have. These 7 PDFs are the complete set. Nothing more will arrive.
Every gap must be closed on site, not by asking for files.

**What this means.** We can build a correct 2D spatial model of the building now. Heights are in no file,
so normal Indian construction values are adopted (section 1.10) and marked ASSUMED. 3D and AR work can start
on them. A later site check corrects them. Each floor's AR plate re-fixes that floor's height, so a wrong
assumed height does not break AR on that floor.

**Main design choices (PROPOSED).**

1. One building-local coordinate frame in metres. Origin at the lift shaft. Every object, every floor,
   every anchor, every device uses it.
2. One `SpatialObject` shape for everything: flats, rooms, walls, tanks, switch boards, anchors.
3. Phone localization = ARKit/ARCore tracking + a few known landmarks per floor for the absolute fix.
   Landmarks are physical plates at lift landings, not QR codes on every wall. Cloud anchors are added
   later for markerless fixes.
4. IoT devices attach to spatial objects. The Digital Twin is that same registry plus live state and history.

**Next step.** See the last section.

---

## 1. Building understanding

### 1.1 Files received

| File | Kind | Scale | Units | Date / status | Gives us |
| --- | --- | --- | --- | --- | --- |
| Floor Plans_Laxmi-Pushp.pdf (8 pages) | Brochure (PowerPoint). Plans are raster images. | none stated | feet-inches, sq.ft | undated, "proposed" | Rendering, location, specs, GF plan, 1st, 2nd&5th, 3rd&4th, 6th plans, area tables |
| 24_Typical Floor Plumbing Layout-For Review.pdf | AutoCAD vector, A3 | **1:75** (verified, see 1.8) | mm | R0, 18/08/2022, **FOR REVIEW** | Typical floor walls, column markers C1–C37 and LC1–LC4, fixture positions and heights, rainwater outlets |
| 19_Electrical Layout- 01..05.pdf (5 files) | AutoCAD vector, A4 | NTS (not to scale) | mm offsets | R0, 23/04/2022, GOOD FOR CONSTRUCTION | Per-flat switch boards, DB, lights, fans, points, mounting heights, key plan |

Do not exist. The architect confirmed these 7 PDFs are all they have. The items below will never arrive.
Each one is replaced by a site measurement or a site walk (section 13):

- A 3D model file (.skp, .rvt, .ifc, .dwg, .obj). Only a rendered picture exists (brochure page 2).
- The AutoCAD source files (.dwg) named in the PDF title blocks. We work from the PDFs.
- Site plan with survey coordinates. Sections. Elevations with levels. Terrace or roof plan.
- Ground-floor services: underground tank, pump room, meter room, main distribution board.
- Plumbing riser diagram. Electrical single-line diagram for common areas. Fire-safety drawings. Lift drawings.
- Structural drawings (column sizes, beam layout, slab levels).

### 1.2 The building

- One block. Ground floor + 6 upper floors (G+6). No basement is drawn.
- Ground floor: 4 shops, 17 car parking slots, 3 two-wheeler zones, entrance lobby, lift, stair, common toilet.
- Floors 1 to 5: 5 flats each, same plan. Only balcony sizes differ between floor 1, floors 2&5 and floors 3&4.
- Floor 6: 2 flats plus two open-to-sky terraces.
- Total: 27 flats, 4 shops.
- Structure (brochure spec): earthquake-resistant RCC frame. Internal walls 4 in (≈100 mm). External walls 6 in (≈150 mm).
- One lift, 8 persons, battery backup. Lift shaft internal size 1.85 × 1.60 m (GF plan label).
- One staircase, east of the lift, two flights per floor.
- CCTV in common areas, solar power for common lights, name plates on every flat door and in the lobby (brochure). Positions UNKNOWN.

### 1.3 Ground floor

North is up on the plan.

- West side: 12.0 m wide road. The west plot boundary is slanted against plan north.
- South side: 6.0 m wide road. North and east: adjacent plots.
- Entries: one from the west road (north-west corner, marked ENTRY). Two from the south road.
- Shops sit along the west edge and face the west road. Each shop has steps up from the road.
- Driveway at least 9 ft 6 in wide, loops around the core.
- Core (lift shaft, stair, entrance lobby, common toilet) sits centre-east.
- Car slots 01–09 along the north boundary, 10–16 along the south row, 17 near Shop 04 at the south-west.
- Two-wheeler parking west of the core, east of the core, and "additional" at the north-east corner.

### 1.4 Typical floor (floors 1 to 5)

Flat numbers are `floor × 100 + position`. Positions are fixed on every floor:

| Position | Type | Where on the plan | RERA carpet (sq.ft) |
| --- | --- | --- | --- |
| 01 | 1BHK | south-east | 471 |
| 02 | 2BHK | south / south-west | 685 |
| 03 | 2BHK | west / north-west | 692 |
| 04 | 1BHK | north, centre | 447 |
| 05 | 1BHK | north-east | 463 |

Flat 05 is close to a mirror of flat 01 across the plumbing duct between their bathrooms.
Flat doors: 04 and 05 open off the east-west lobby leg. 03 opens at the west end of that leg.
02 and 01 open off the south end of the north-south lobby leg, next to the lift.

### 1.5 Sixth floor

- 601 (2BHK, south) uses the footprint of position 02 without its west bedroom.
- 602 (2BHK, north-west) uses the footprint of position 03, with a larger kitchen and two private terraces.
- Open-to-sky terraces cover the footprints of positions 04, 05 and 01. Doors from the lobby lead to them.
- An unlabeled box with an X is drawn east of the stair. Its purpose is UNKNOWN (duct or machine base?).
- Roof above floor 6, lift machine room, overhead water tank, solar panels: not drawn. UNKNOWN.

### 1.6 Vertical core and shafts (same position on every floor)

| Element | Size on plan | Note |
| --- | --- | --- |
| Lift shaft | 1.85 × 1.60 m internal | continuous G to 6; the best fixed reference in the building |
| Staircase | east of lift | UP/DN, two flights; continuous G to 6 |
| Lobby, east-west leg | 4 ft 3 in wide | north of the ventilation shaft |
| Lobby, north-south leg | 6 ft+ wide | between ventilation shaft and lift |
| Ventilation shaft | 8 ft × 17 ft 3 in | open shaft, west of the north-south lobby |
| Small shaft | 3 ft 6 in × 10 ft 6 in | west of the ventilation shaft, next to kitchen of 03 |
| Duct (plumbing shaft) | 4 ft × 7 ft | between bathrooms of 01 and 05; electrical drawing calls it PLUMBING SHAFT |

### 1.7 Services that are drawn

**Plumbing (typical floor, FOR REVIEW, not final).**

- Fixture positions per flat: wash basin, commode, shower and mixer, kitchen sink, bib cocks, jet spray, nahni trap, washing-machine point.
- Mounting heights from floor finish: basin and pillar tap 32 in, commode 16.5 in, mixer tap 32 in, shower 7 ft, kitchen sink over platform 32 in, bib cock and jet spray 1 ft, bib cock 32 in, nahni trap 4 in from corner, washing machine 1 ft.
- Offsets in mm from columns and walls for sinks and fixtures (for example 1750 from column C23).
- Rainwater outlets at the north-east corner and the south-east corner. Blue arrows show floor slope to drains.
- Column markers C1 to C37 and lift columns LC1 to LC4. These are RCC columns. They are permanent and visible in the parking floor.
- Not drawn: risers, down-take pipes, drainage stacks, tank and pump. Routes are UNKNOWN.

**Electrical (per flat, GOOD FOR CONSTRUCTION, not to scale).**

- Switch boards with module count and mounting height. Typical 1500 mm to top of board. TV and socket board 600 mm. Toilet board 1575 mm. Dry-balcony exterior board 1050 mm. Distribution board (DB) and bell buzzer on loft at 2750 mm. Heights are measured from SSL (slab level, as labelled) to top of board.
- Board counts: flat 01 has SB plus SB1–SB12. Flat 02: SB1–SB16. Flat 03: SB1–SB17. Flat 04: SB1–SB10. Flat 05: SB1–SB12. Each flat has one DB and one bell buzzer.
- Ceiling lights, ceiling fans, bracket lights, TV cable point, geyser, exhaust fan, refrigerator, mixer, water purifier, washing machine points.
- Board offsets in mm from walls (150, 1050, 1300, 1700, 1800 and so on).
- Dashed lines are circuit groups, not conduit routes. Conduit routes are UNKNOWN.
- Not drawn: lobby lights, lift power, meter room, pump supply, solar. UNKNOWN.

### 1.8 Units, scale, orientation, heights

| Item | Value | Status |
| --- | --- | --- |
| Brochure units | feet-inches, sq.ft | trusted labels; images are not to scale |
| CAD units | mm | trusted |
| Plumbing drawing scale | 1:75 on A3. 1 PDF point = 26.46 mm real | **verified**: lift shaft measures 1.87 × 1.63 m (stated 1.85 × 1.60), shaft wall 152 mm (spec 6 in = 152.4 mm) |
| Electrical drawings scale | NTS | do not measure them; use their mm offsets |
| Plan north | up on every plan | trusted, consistent across all files |
| True-north heading of plan Y axis | 0° ± 5° (plan north ≈ true north) | ASSUMED from the Google Earth picture, see 1.10 |
| Geo coordinates of the building | 16.837104, 74.596603 (Google Maps pin, 2026-09-27) | DECIDED for now; a few metres of error is fine |
| Floor-to-floor height, floors 1–6 | 3.00 m | ASSUMED, see 1.10 |
| Ground floor height (shops, parking) | 3.30 m | ASSUMED, see 1.10 |
| Plinth height above road | 0.60 m | ASSUMED, see 1.10 |
| Floor finish thickness (SSL to FFL) | 0.05 m | ASSUMED, see 1.10 |
| Slab thickness | 0.15 m | ASSUMED, only used for 3D |
| Loft height, ceiling height | "DB on loft at 2750 mm" → clear height about 2.9 m | consistent with 3.00 m floor-to-floor |
| Wall thickness | 4 in internal, 6 in external (spec) | REQUIRES_HUMAN_VALIDATION |
| Door and window sizes | not labelled | UNKNOWN |
| Column sizes | not labelled; drawn with X markers | REQUIRES_MEASUREMENT (or structural drawing) |

### 1.9 Things the drawings cannot tell us

- Whether the built building matches the drawings. All drawings say "proposed" (2022). REQUIRES_HUMAN_VALIDATION on site.
- Any height or level. See 1.8.
- Location of: overhead tank, underground tank, pump, main DB, meters, CCTV, gates, fire extinguishers, solar panels, lift machine room.
- Pipe routes, conduit routes, drainage stacks.
- Exact balcony sizes per floor pair (areas are given; some plan labels are small and unclear). REQUIRES_HUMAN_VALIDATION.
- The sixth-floor box east of the stair.

### 1.10 Values adopted without site access

Nobody is on site. These values come from the drawings where possible, and from normal Indian residential
construction practice where not. Each one carries its basis. A later site check replaces them; object ids
and X,Y geometry do not change when that happens.

| # | Item | Adopted value | How it was obtained | Status |
| --- | --- | --- | --- | --- |
| 1 | Floor-to-floor, floors 1 to 6 | **3.00 m** | Normal value for Indian residential RCC. The electrical schedule puts the DB top at 2.75 m above slab, so clear height is about 2.9 m. 2.9 m clear + 0.15 m slab ≈ 3.0 m. Plausible range 2.9–3.1 m. | ASSUMED |
| 2 | Ground floor, floor-to-floor | **3.30 m** | The rendering shows the shop storey about 10 % taller than a flat storey. Shops normally get 3.0 m clear or more. Plausible range 3.0–3.6 m. | ASSUMED |
| 3 | Plinth, road to ground floor | **0.60 m** | The rendering shows 4 risers at each shop entry. 4 × 0.15 m. Whether the parking floor is at the shop floor level is not shown. | ASSUMED; parking level REQUIRES_HUMAN_VALIDATION |
| 4 | Finish thickness, slab top to tile top | **0.05 m** | Vitrified tile ≈ 10 mm on a ≈ 40 mm bed. Normal. Electrical heights are from SSL, so height above tile = schedule value − 0.05 m. | ASSUMED |
| 5 | Lift door | opening **1.00 m** wide on the **west** face, centred; centre **0.97 m north** of the origin; nibs 0.30 m each side; shaft outer 2.17 × 1.94 m, inner 1.87 × 1.63 m, wall 0.15 m | Measured on the 1:75 plumbing PDF at 300 dpi (6.35 mm per pixel). | DERIVED, high confidence |
| 6 | Heading of +Y (plan north) | **0°**, tolerance ± 5° | On the north-up Google Earth picture the plot's north edge is within about 4° of horizontal. The picture is low resolution. | ASSUMED |
| 7 | Lat/lon of the origin | **16.837104, 74.596603** | Google Maps pin on the building, supplied 2026-09-27. Pin error is a few metres. Good enough for outdoor hand-off. | DECIDED |
| 8 | Tank, pump, meters, main DB positions | unknown | A photo from any resident, or a site walk. | OPEN |

Level elevations that follow from items 1–3 (finished floor level, metres, relative to ground floor):

```
road   −0.60      L0  0.00      L1  3.30      L2  6.30      L3  9.30
L4     12.30      L5  15.30     L6  18.30     roof 21.30 (top of the L6 storey)
```

---

## 2. Extracted spatial entities (inventory v0)

Sizes are plan labels in feet-inches from the brochure. They are room-name labels, not measured geometry.

### 2.1 Ground floor

| Code | Type | Size / count | Note |
| --- | --- | --- | --- |
| SHOP-01 | shop | 18'3" × 11'6" (210 sq.ft carpet) | west edge, north end |
| SHOP-02 | shop | 9'6" × 9'9" + 6' × 6'9" (134) | |
| SHOP-03 | shop | 18'3" × 10' (183) | |
| SHOP-04 | shop | 12'6" × 11' (149) | south end |
| CAR-01 … CAR-17 | parking slot | 17 | numbered on plan |
| TW-WEST, TW-EAST, TW-NE | two-wheeler zone | 3 | |
| DRIVEWAY | corridor | ≥ 9'6" wide | loop |
| LOBBY-G | common | | around lift and stair |
| LIFT-SHAFT | shaft | 1.85 × 1.60 m | |
| STAIR | stair | | east of lift |
| TOILET-G | common toilet | | south of lift |
| ENTRY-W, ENTRY-S1, ENTRY-S2 | entrance | 3 | |

### 2.2 Typical floor template (floors 1–5), rooms per position

| Position | Rooms (label size) |
| --- | --- |
| 01 (1BHK) | Living 11'×11'3" · Kitchen 10'×10' · Bedroom 10'×11'3" · Bath 4'×6'9" · WC 3'×4' · Balcony 11'×3' · Dry balcony 3'×10' · Wardrobe niche 6'9"×3'3" |
| 02 (2BHK) | Living/Dining 11'×14'6" · Kitchen 9'×11'3" · M.Bedroom 11'9"×11'3" · Bedroom 13'3"×10' · Toilet 4'×11'3" · Toilet 4'×8' · Dry balcony 9'×3' · 2 balconies (size varies by floor) |
| 03 (2BHK) | Living/Dining 11'×13' · Kitchen 10'×10'3" · M.Bedroom 13'6"×11'6" · Bedroom 10'9"×10' · Toilet 4'×8'6" · Toilet 4'×8' · Dry balcony 3'6"×6'3" · Balcony 8'3"×5' · 2 balconies (size varies by floor) |
| 04 (1BHK) | Living 11'×12'9" · Kitchen 9'×9'6" · Bedroom 11'×12'9" · Toilet 4'×7'6" · Dry balcony 9'×3' |
| 05 (1BHK) | Living 11'×11' · Kitchen 10'×10' · Bedroom 10'×11'3" · Bath 4'×6'9" · WC 3'×4' · Balcony 11'×3' · Dry balcony 3'×10' |
| core | Lobby E-W 4'3" · Lobby N-S 6'+ · Ventilation shaft 8'×17'3" · Small shaft 3'6"×10'6" · Duct 4'×7' · Lift · Stair |

Balcony areas by floor (brochure table, sq.ft):

| Position | Floor 1 | Floors 2 & 5 | Floors 3 & 4 |
| --- | --- | --- | --- |
| 01 | 61 | 61 | 61 |
| 02 | 120 | 66 | 99 |
| 03 | 135 | 81 | 114 |
| 04 | 25 | 25 | 25 |
| 05 | 62 | 62 | 62 |

### 2.3 Sixth floor

| Code | Rooms |
| --- | --- |
| 601 (2BHK, 551 sq.ft) | Living/Dining 11'×14'6" · Kitchen 9'×11'3" · M.Bedroom 11'9"×11'3" · Toilet 4'×11'3" · Toilet 4'×8' · Dry balcony 9'×3' · Balcony 4'6"×11' · half terrace 90 sq.ft |
| 602 (2BHK, 634 sq.ft) | Living 11'×13' · Kitchen 10'×14'3" · M.Bedroom 13'6"×11'6" · Toilet 4'×8'6" · Toilet 4'×8' · Dry balcony 3'6"×6'3" · Balcony 4'6"×11'6" · Balcony 8'3"×5' · Terrace 15'3"×9'9" · Terrace 18'×10' · half terrace 75 sq.ft |
| TERRACE-N, TERRACE-E | open-to-sky terraces | common or private: REQUIRES_HUMAN_VALIDATION |

### 2.4 Infrastructure and equipment from drawings (per typical floor)

| Class | Items | Position source | Height source |
| --- | --- | --- | --- |
| Switch boards | 67 per floor (12+16+17+10+12) | electrical layout offsets (mm) | schedule (600 / 1050 / 1500 / 1575 mm) |
| Distribution boards | 5 per floor (one per flat, on loft) | electrical layout | 2750 mm |
| Bell buzzers | 5 per floor | electrical layout | 2750 mm |
| Sanitary fixtures | per plumbing legend, all flats | plumbing 1:75 | legend heights |
| Kitchen sinks | 5 per floor | plumbing 1:75 with mm offsets | 32 in over platform |
| Rainwater outlets | 2 per floor (NE, SE) | plumbing 1:75 | slab level |
| Columns | C1–C37, LC1–LC4 | plumbing 1:75 | full height |
| Shafts | ventilation, small, duct, lift | all plans | full height |

### 2.5 Equipment known to exist but not located (site walk needed)

Overhead tank, underground tank, pump, main incoming supply and meters, common DBs, lift machine, CCTV cameras, gates, fire extinguishers, solar panels, common toilet fittings, lobby lights. All UNKNOWN position.

---

## 3. Coordinate and reference strategy

### 3.1 One frame for the whole society (PROPOSED)

Name: **BLCS** (Building Local Coordinate System).

```
units     metres, right-handed
origin    outer south-west corner of the lift shaft wall, at ground-floor finished floor level
+X        plan east (to the right on every drawing)
+Y        plan north (up on every drawing)
+Z        up
```

Why the lift shaft:

- It is at the same X,Y on every floor. It is a vertical line through the building.
- Its corner is a hard RCC edge that a person can touch in the lobby on every floor.
- Its size is stated on the plan and verified on the CAD drawing.

Per-floor check point: the centre of the lift door frame at each landing. Same X,Y on every floor. Z = that floor's FFL.
From the 1:75 drawing: the door is on the west face of the shaft, the opening is 1.00 m wide, and its centre is at
BLCS (0.00, 0.97) on every floor. The shaft outer footprint is 2.17 m east-west by 1.94 m north-south from the origin.

### 3.2 Levels

```
level  index  elevation_m (FFL, relative to L0)  height_m   template            status
L0     0      0.00                               3.30       GF                  height ASSUMED
L1     1      3.30                               3.00       TYP + balcony-A     ASSUMED
L2     2      6.30                               3.00       TYP + balcony-B     ASSUMED
L3     3      9.30                               3.00       TYP + balcony-C     ASSUMED
L4     4      12.30                              3.00       TYP + balcony-C     ASSUMED
L5     5      15.30                              3.00       TYP + balcony-B     ASSUMED
L6     6      18.30                              3.00       SIXTH               ASSUMED
RF     7      21.30                              —          ROOF (not drawn)    ASSUMED
```

A level's geometry is 2D in X,Y plus its `elevation_m`. Stacking is only a Z offset. The elevations above
come from section 1.10. If a site check changes a height, only the `elevation_m` column changes.

### 3.3 Templates

Floors 1–5 share one template `TYP`. The template holds walls, rooms, core, columns, fixtures and switch boards once.
A level instance references the template and adds its balcony variant and its flat numbers (`3xx` on L3).
This keeps one source of truth for 5 floors.

### 3.4 Linking 2D drawings to BLCS

Every drawing gets one affine transform to BLCS:

- Plumbing PDF: `x_mm = (pt_x − pt_x0) × 26.46`, `y_mm = (pt_y0 − pt_y) × 26.46`, then ÷1000 to metres.
  `pt_x0, pt_y0` = the lift shaft corner in PDF points. This is exact enough for walls and columns.
- Brochure raster plans (GF, 6th): a similarity transform (scale, rotation, offset) fitted to the lift shaft
  and two labelled room sizes. Lower confidence. Mark every polygon from them `source.confidence: "medium"`.
- Electrical layouts: not to scale. Use them only for board positions as offsets from a wall that is already
  in BLCS from the plumbing drawing.

### 3.5 Linking BLCS to the world

One record on the building: `{ lat, lon, alt_m, heading_deg }` of the origin, where `heading_deg` is the
true-north bearing of +Y. Heading is ASSUMED 0° (section 1.10). Lat/lon is 16.837104, 74.596603 from a
Google Maps pin. It is needed only for outdoor GPS hand-off and maps.
Indoor AR never needs it.

### 3.6 What lives in the frame

| Thing | Geometry in BLCS |
| --- | --- |
| Room, flat, shop, parking slot | polygon (X,Y) + level |
| Wall, column | polygon or line + thickness + level |
| Door, window | point on a wall + width + swing |
| Equipment, POI, fixture, switch board | point (X,Y,Z) + optional box + rotation |
| Anchor (localization landmark) | pose (X,Y,Z + rotation) |
| IoT device | none of its own; it points to an equipment object |
| Nav node | point (X,Y,Z) + level; edges join nodes, also across levels |
| AR device pose at runtime | X,Y,Z + rotation + level + confidence |

---

## 4. Spatial data model (conceptual)

### 4.1 Hierarchy and how it maps to what exists

```
Society  (exists: Prisma Society)
└─ Building  (exists: Prisma Building)     + frame, world link, levels
   └─ Level  (new)                          index, elevation, height, plan rasters + transforms
      ├─ Zone  (new; Flat exists)           flat | shop | common | parking | terrace | shaft ; polygon
      │  └─ Space  (new)                    room ; polygon ; name
      ├─ Element  (new)                     wall | column | door | window | stair | lift | shaft
      ├─ Asset  (new)                       equipment | fixture | switch_board | poi | camera | sensor …
      ├─ NavNode / NavEdge  (new)           routing graph ; edges may cross levels (lift, stair)
      └─ Anchor  (new)                      localization landmark ; pose in BLCS ; provider payload
Device  (new)  ─── linked to one Asset      IoT identity, protocol, capabilities
State / Reading / Event  (new)              latest values, history, alerts, maintenance
```

The existing `Flat` (number, floor, type, areaSqft) stays the business record. The new `Zone` of kind `flat`
carries its geometry and links to it by `flatId`. Do not merge them; money and membership must not depend
on geometry.

### 4.2 One shape for every physical object

```json
{
  "id": "spo_01J8...",
  "code": "B1/L3/F301/KITCHEN",
  "kind": "space",
  "subtype": "kitchen",
  "name": "Kitchen",
  "buildingId": "bld_…",
  "levelId": "L3",
  "parentId": "spo_flat_301",
  "geometry": {
    "type": "polygon",
    "coords": [[8.21, -2.10], [11.26, -2.10], [11.26, 0.95], [8.21, 0.95]],
    "z": null,
    "heightM": null
  },
  "pose": null,
  "dimensions": { "labelFt": "10'x10'", "areaSqft": null },
  "relations": [
    { "type": "contained_in", "target": "spo_flat_301" },
    { "type": "adjacent_to", "target": "B1/L3/F301/LIVING" },
    { "type": "opens_to", "target": "B1/L3/F301/DRY_BALCONY" }
  ],
  "source": {
    "drawing": "Floor Plans_Laxmi-Pushp.pdf p7",
    "method": "raster-fit",
    "confidence": "medium",
    "validation": "REQUIRES_HUMAN_VALIDATION"
  },
  "ar": { "label": "Kitchen", "icon": "kitchen", "showAtDistanceM": 6 },
  "deviceId": null,
  "tags": ["flat", "301"]
}
```

Rules:

- `id` is stable and opaque. `code` is human-readable and unique inside the building. Both never change.
- `geometry` is always in BLCS metres. `z` and `heightM` stay `null` until measured. Null is allowed. Guessing is not.
- `source` is mandatory. Every object says where it came from and how much to trust it.
- `relations` are typed edges. Start with: `contained_in`, `adjacent_to`, `opens_to`, `connects_to`, `feeds`, `controls`, `serves`.
- `ar` and `deviceId` are optional. A wall has neither. A tank has both.

### 4.3 Building file (Phase 1 output)

```json
{
  "schemaVersion": "0.1",
  "building": {
    "code": "B1",
    "name": "Laxmi-Pushp",
    "frame": {
      "units": "m",
      "originDescription": "outer SW corner of lift shaft wall, GF FFL",
      "axes": { "x": "plan east", "y": "plan north", "z": "up" },
      "world": { "lat": 16.837104, "lon": 74.596603, "altM": null, "headingDeg": 0, "status": "lat/lon from Google Maps pin; headingDeg ASSUMED; altM OPEN" }
    },
    "levels": [
      { "id": "L0", "index": 0, "name": "Ground", "elevationM": 0.0, "heightM": 3.3, "template": "GF", "heightStatus": "ASSUMED" },
      { "id": "L1", "index": 1, "name": "First", "elevationM": 3.3, "heightM": 3.0, "template": "TYP", "variant": "balcony-A", "heightStatus": "ASSUMED" },
      { "id": "L6", "index": 6, "name": "Sixth", "elevationM": 18.3, "heightM": 3.0, "template": "SIXTH", "heightStatus": "ASSUMED" }
    ],
    "templates": { "TYP": { "objects": ["…SpatialObject…"] }, "GF": {}, "SIXTH": {} },
    "drawings": [
      { "file": "24_Typical Floor Plumbing Layout-For Review.pdf", "scale": "1:75", "unit": "mm",
        "toBlcs": { "ptPerM": 37.79, "originPt": [null, null] }, "status": "FOR_REVIEW" }
    ]
  }
}
```

### 4.4 Equipment with a device (the water tank example)

```json
{
  "id": "spo_tank_01",
  "code": "B1/RF/TANK-01",
  "kind": "asset",
  "subtype": "water_tank",
  "name": "Overhead tank 1",
  "levelId": "RF",
  "geometry": { "type": "box", "center": [null, null, null], "size": [null, null, null] },
  "source": { "drawing": null, "method": "site-walk", "confidence": "none", "validation": "REQUIRES_MEASUREMENT" },
  "relations": [
    { "type": "fed_by", "target": "B1/L0/PUMP-01" },
    { "type": "serves", "target": "B1" }
  ],
  "ar": { "label": "Tank 1", "icon": "tank", "model": "tank.glb", "showAtDistanceM": 15 },
  "deviceId": "dev_tank01_level",
  "capabilities": ["water_level_pct"]
}
```

### 4.5 Anchor (localization landmark)

```json
{
  "id": "anc_L3_lift",
  "code": "B1/L3/ANCHOR/LIFT-LANDING",
  "kind": "anchor",
  "levelId": "L3",
  "pose": { "position": [0.93, 1.72, 1.40], "rotation": [0, 0, 0, 1] },
  "providers": {
    "image": { "assetId": "plate_L3.png", "physicalWidthM": 0.30 },
    "cloudAnchor": { "id": null, "hostedAt": null, "expiresAt": null }
  },
  "source": { "method": "measured-from-lift-door", "confidence": "high", "validation": "REQUIRES_MEASUREMENT" }
}
```

### 4.6 Navigation graph

```json
{ "nodes": [
    { "id": "n_L3_lift", "levelId": "L3", "p": [0.93, 1.72], "kind": "lift_door" },
    { "id": "n_L3_lobby_ns", "levelId": "L3", "p": [-1.10, 1.72], "kind": "corridor" },
    { "id": "n_L3_door_301", "levelId": "L3", "p": [1.60, -0.40], "kind": "flat_door", "zone": "B1/L3/F301" },
    { "id": "n_L2_lift", "levelId": "L2", "p": [0.93, 1.72], "kind": "lift_door" }
  ],
  "edges": [
    { "a": "n_L3_lift", "b": "n_L3_lobby_ns", "kind": "walk" },
    { "a": "n_L3_lobby_ns", "b": "n_L3_door_301", "kind": "walk" },
    { "a": "n_L3_lift", "b": "n_L2_lift", "kind": "lift", "costS": 40 }
  ] }
```

Coordinates above are illustrative. Real values come from Phase 1.

---

## 5. 2D → 3D → AR relationship

```
2D polygons per template (X,Y in BLCS, from drawings)
        │  + level elevation and height (measured)
        ▼
3D per level = extrude walls/columns to heightM, cut door/window boxes, floor slab at elevationM
        │  export glTF per level; keep the same ids as the 2D objects
        ▼
AR scene = 3D content placed with the transform T_ar_from_blcs (found by localization, section 6)
        │  the phone never sees BLCS directly; it sees the AR world; T converts between them
        ▼
Same ids → same object in mobile map, AR, admin dashboard, IoT, twin
```

Rules:

- 2D is the source of truth. 3D is generated from it by a script, never hand-edited.
- Ids are shared across 2D, 3D and AR. An AR tap on a mesh returns a `SpatialObject.id`.
- Optional scanned meshes (LiDAR) are visual extras, aligned into BLCS. They are not the model.

---

## 6. Camera-based localization strategy

### 6.1 The honest picture of what phones can do indoors

| Technology | Gives | Indoors in this building | Cost | Verdict |
| --- | --- | --- | --- | --- |
| ARKit / ARCore VIO | smooth 6-DoF motion, no absolute position, drifts about 1–3 % of distance | works | free | base layer, always on |
| Plane detection | floor and wall planes | works | free | use for Z snap and drift correction |
| Reference images (ARCore Augmented Images, ARKit ARReferenceImage) | absolute pose relative to a known flat picture | works, offline, deterministic | free (print plates) | **primary absolute fix** |
| ARCore Cloud Anchors | markerless absolute pose from a hosted feature map | works, needs same lighting, needs a Google Cloud project, anchors expire (TTL up to 365 days) | free tier | **secondary, markerless fix**; verify current API terms first |
| ARKit ARWorldMap | markerless relocalization | iOS only, brittle, local file | free | not primary |
| Google Geospatial VPS | absolute geo pose from Street View imagery | outdoor only; not covered in Sangli lanes | free | outdoor hand-off only, LATER |
| Niantic Lightship VPS, Immersal | markerless VPS from own scans | possible; terms and cost unclear; vendor lock-in | varies | evaluate LATER |
| Azure Spatial Anchors | — | retired Nov 2024 | — | do not use |
| Barometer | relative floor change | works on most phones | free | floor-change hint |
| BLE beacons | which floor / zone | works, 1 beacon per landing | ₹500–1500 each | optional floor detection, LATER |
| Wi-Fi RTT | 1–2 m ranging | needs 802.11mc access points; rare | hardware | no |
| UWB | 10–30 cm ranging | needs anchors and UWB phones | hardware | no |
| OCR of signage | which floor / which flat door | works on name plates and floor signs | free | floor detection helper |
| QR codes | absolute fix | works | free | fallback only |

Key fact about this building: floors 1 to 5 are identical. Any camera-only method will confuse floor 2 with floor 3.
Floor identity must come from something that differs per floor: a plate with the floor number, a name plate,
a beacon, a barometer delta since the last known floor, or the user.

### 6.2 Recommended hybrid (PROPOSED)

```
Layer 0  ARKit/ARCore VIO          continuous relative pose, plane detection
Layer 1  Floor identity            plate at each lift landing (reference image + printed floor number)
                                   + barometer delta + last lift stop + user tap as last resort
Layer 2  Absolute fix              reference-image plate (offline) → pose of plate in AR world
                                   plate.pose in BLCS is known → T_blcs_from_ar = plate.pose_blcs × inv(plate.pose_ar)
Layer 3  Markerless fix (later)    Cloud Anchors hosted at the same landmarks; resolve when in view; same math
Layer 4  Correction                floor plane → Z; detected wall planes vs model walls → small yaw/XY nudges;
                                   re-fix at every landmark passed; decay confidence with distance and time
```

Landmark set for this building (about 12 plates, not "QR everywhere"):

- Entrance lobby (1), ground-floor parking columns (2), lift landing on each floor 1–6 (6), sixth-floor terrace door (1), tank area on roof (1), meter room or pump room (1).
- A plate is a printed A4 poster: building name, floor number, MOVO logo, and a textured pattern. It is useful signage on its own. It is not a QR code.
- Each plate's pose in BLCS is measured once from the lift door frame with a tape (X,Y from the frame, Z from the floor).

Why plates first, cloud anchors second:

- Plates work offline, on day one, on every ARCore/ARKit phone, with zero accounts and near-zero cost.
- Cloud anchors need a Google Cloud project, hosting visits, re-hosting after expiry, and good lighting. They are the upgrade, not the base.

### 6.3 Output of localization

```json
{ "levelId": "L3", "positionBlcs": [1.42, -0.35, 1.30], "yawDeg": 184,
  "confidence": 0.82, "lastFixAgeS": 12, "distanceSinceFixM": 7.5, "fixSource": "plate:anc_L3_lift" }
```

Content is shown only when `confidence` is above a threshold per feature (section 10). Below it, the AR view
shows a guide arrow to the nearest landmark and the 2D map keeps working.

### 6.4 Recovery

- Tracking lost (lift ride, fast motion, dark): keep last pose, set confidence 0, ask to look at the nearest plate.
- Wrong floor suspected (barometer moved, or plate says another floor): drop pose, re-fix.
- Drift: confidence decays with `distanceSinceFixM`; the app nudges the user past a landmark on long routes.
- Nothing works: 2D map with a manual "I am at…" picker. This must always exist.

---

## 7. AR architecture

```
┌──────────────── Mobile app (React Native 0.87) ─────────────────┐
│  JS: screens, spatial store, nav routing, IoT state (WebSocket) │
│  ───────────────────── bridge (native component) ────────────── │
│  Native AR module: ARKit (Swift) / ARCore (Kotlin)              │
│    • session, VIO, planes, reference images, (cloud anchors)    │
│    • holds T_ar_from_blcs; places content given in BLCS          │
│    • emits pose + confidence to JS; JS decides what to show      │
└──────────────────────────────────────────────────────────────────┘
                 │ REST: building.json, assets, anchors, nav graph (cached offline)
                 │ WS:   live device state
┌──────────────── API (NestJS, existing) ────────────────────────┐
│  spatial module: objects, levels, anchors, nav graph, versions  │
│  iot module: devices, ingest, latest state, history             │
└──────────────────────────────────────────────────────────────────┘
```

AR needs native code. It cannot be done in JS. Two ways to get it into the RN app:

- Native module (ARKit + ARCore) written for MOVO. Full control. Reference images and cloud anchors available. More work.
- ViroReact (community). Fast to start. Image targets available. No cloud anchors. Community-maintained.

Recommendation: the native module. See the decision at the end.

Experiences, in build order:

1. **Labels**: room and flat names, floor name, POI icons near the user. Needs ~1 m accuracy.
2. **Navigation**: route on the nav graph (A*), drawn as a line on the floor plane, turn hints, lift and stair steps as text. Needs ~1 m and the right floor.
3. **Building information**: tap a flat door label → flat card (type, floor; never occupant data without permission).
4. **Infrastructure overlay** of documented items only: switch boards, DBs, kitchen sinks, sanitary fixtures, rainwater outlets, shafts, columns. Drawn as markers on walls. Needs ~0.2 m and a recent fix. Pipe and conduit routes are not drawn on any drawing, so the app must not draw them until a route survey exists.
5. **IoT cards**: tank, pump, panel, gate, camera state at the object's position.

Privacy rule: AR inside a flat is only for the flat's own members. Common areas for everyone. Camera frames never leave the phone except for a cloud-anchor resolve, and that is opt-in.

---

## 8. IoT → spatial object

```
Physical sensor  →  Device (id, protocol, capabilities)  →  Asset (SpatialObject with deviceId)
                                                         ↘  State (latest)  ↘  Readings (history)
```

- A device never has its own position. It points to an asset. Move the asset, and the device moves with it.
- Capabilities are named values: `water_level_pct`, `pump_on`, `flow_lpm`, `door_open`, `power_w`.
- Ingest path (₹0): MQTT broker (Mosquitto) → NestJS subscriber → PostgreSQL `device_state` (latest) + `device_reading` (history) → WebSocket to clients.
- Relations carry the logic: `PUMP-01 feeds TANK-01`. The AR card on the tank can show the pump state through the relation.

Example live view:

```json
{ "asset": "B1/RF/TANK-01", "state": { "water_level_pct": 72, "updatedAt": "…" },
  "related": [ { "asset": "B1/L0/PUMP-01", "state": { "pump_on": true } } ] }
```

Hardware and protocols are LATER. The model must not depend on a vendor.

---

## 9. Digital Twin architecture

The twin is not a new system. It is the same registry with time added.

```
Spatial model (static, versioned)   = building.json + 3D + nav graph + anchors
Asset registry                       = SpatialObjects of kind asset
Device registry                      = Devices
Live state                           = latest value per capability
History                              = readings, time-series
Events                               = alerts, maintenance, inspections, drawing revisions
One API                              = GET /spatial/objects/:id  → static + relations + live + last events
```

Consumers: mobile map, AR, admin web, IoT rules, maintenance tasks (existing `Task`), analytics later.

Versioning: every drawing revision or site validation produces a new model version. Objects keep their ids
across versions. AR and nav always load one pinned version.

Storage: PostgreSQL (existing) with JSON geometry columns is enough for one building. PostGIS and a time-series
store are LATER.

---

## 10. Accuracy and validation

### 10.1 Trust levels for what we extracted

| Trusted from drawings | Requires human validation | Assumed now, confirm later (section 1.10) | Still open | Capture with phone |
| --- | --- | --- | --- | --- |
| flat numbering and positions · room names and label sizes · core layout · column positions (1:75) · lift door position and width (1:75) · fixture positions and heights · switch-board positions and heights · parking layout and count · shop sizes · entries · plan north | plumbing is FOR REVIEW, not final · built building vs drawings · wall thickness · balcony sizes per floor · name-plate design and position · sixth-floor unlabeled box · terrace ownership · parking floor level vs shop floor level | floor-to-floor 3.00 m · GF 3.30 m · plinth 0.60 m · finish 0.05 m · slab 0.15 m · heading 0° | lat/lon of origin (Google Maps pin) · tank, pump, meter, DB, CCTV, gate, extinguisher, solar positions · plate poses (measured when plates go up) | plate photos for reference images · cloud-anchor hosting scans · LiDAR or photo scans of lobby, parking, terrace (optional) · AR tape measure as cross-check |

### 10.2 Accuracy needed per feature

| Feature | Position | Floor identity | Fix age allowed |
| --- | --- | --- | --- |
| Which flat or room am I in | 1–2 m | must be right | minutes |
| Navigate to lift, stair, flat, parking, exit | ~1 m | must be right | minutes, re-fix at landmarks |
| POI label on tank, panel, camera | 0.3–0.5 m | must be right | ~1 min |
| Switch board or DB marker on a wall | 0.1–0.2 m | must be right | seconds, within ~5 m of a plate |
| IoT card at device | ~0.5 m | must be right | ~1 min |
| Pipe or conduit routes in walls | < 0.1 m and route data | — | not possible today: routes are not documented |

### 10.3 Where localization fails in this building

Identical floors · plain painted walls with few features · dark parking at night · corridors with repeating
doors · lift rides (tracking resets) · cars moving in parking · glass and reflections · budget Android phones
without ARCore · expired cloud anchors · plates removed or covered.

### 10.4 Validation plan (Phase 1)

1. Print the typical-floor model on paper. Walk floor 3 and tick every wall, door and shaft. Fix the model.
2. Measure the 8 items in section 13. Fill in `elevationM` and `heightM`.
3. Walk GF, roof and services with a checklist. Add every found equipment as an asset with `method: site-walk`.
4. Re-run the model build. Mark validated objects `validation: "VALIDATED"` with a date and a person.

---

## 11. Risks and limitations

| Risk | Effect | Mitigation |
| --- | --- | --- |
| Floor heights are assumed (3.00 m, GF 3.30 m) | if wrong by 0.1 m per floor, the 3D stack is off by up to 0.6 m at floor 6 | AR re-fixes Z per floor from that floor's plate, so AR is not affected; confirm heights at the first site visit and change one column |
| Drawings are "proposed"; plumbing "for review"; no as-built set exists | model differs from real building | site validation walk; measure what differs |
| Identical floors | wrong-floor AR content | plate per landing + barometer + OCR; never trust camera alone for floor |
| Brochure plans are raster and not to scale; no CAD source exists for GF and 6th | GF and 6th geometry has ~5–10 % error | fit to lift shaft and labelled sizes; tape-measure the lobby, parking bays and terrace edges on site |
| Routes for pipes and conduits do not exist | "hidden infrastructure" AR limited to points, not lines | show documented points only; plan a route survey with the plumber and electrician LATER |
| ₹0 target vs cloud AR services | cloud anchors need a Google Cloud project; VPS vendors cost | plates first; cloud anchors optional |
| AR in React Native | native work, two platforms | one native module with a small API; ship Android first if that is the resident base |
| Device coverage | some residents' phones lack ARCore | 2D map with the same data always works |
| Privacy | camera inside flats, occupant data on doors | flat-scope rules; no occupant names in AR without consent |
| Anchor decay | cloud anchors expire; plates fade | re-host job; laminated plates; plate health check in admin |

---

## 12. Implementation phases

### Phase 1: Spatial foundation (drawings → building.json v0)

1. Freeze the frame (section 3). DECIDED once you say yes.
2. Extract the typical floor from the 1:75 vector PDF with a script: walls, columns C1–C37 and LC1–LC4, shafts, lift, stair, room polygons, door positions. Output the `TYP` template in mm → metres.
3. Extract GF and 6th from the raster plans, fitted to the lift shaft. Mark `confidence: medium`.
4. Add fixtures (plumbing) and switch boards (electrical offsets) as point assets on the template.
5. Fill levels with the adopted values from section 1.10. Add the Google Maps lat/lon.
6. Site validation walk with a checklist, when someone is there. Confirm the 1.10 values first. Tape-measure the GF lobby, parking bays and 6th-floor terrace edges, because no CAD file exists for those floors. Add unlocated equipment as assets.
7. Deliverable: `building.json` v0, inventory, measurement sheet, validation notes. No app code yet.

Do not over-engineer: one JSON file in the repo is the whole Phase 1 output.

### Phase 2: 3D and spatial model — DONE 2026-09-27 (first pass)

- `build_3d.py` extrudes the templates into `laxmi-pushp.glb`, one node per object, ids preserved.
- Walking graph in `building.json` (`nav`): 340 nodes, 326 edges, lift and stair links between floors.
- `viewer.html` (three.js) shows levels, explode, object codes, the graph and a route test.
- Still open: stair as flights, wall thickness from CAD, LiDAR meshes (optional), height confirmation on site.

### Phase 3: AR localization — first pass built 2026-09-27

- Native view `MovoArView` in `packages/ar-native`: ARKit (Swift) and ARCore (Kotlin). It only tracks and renders the camera; it streams the camera pose and plate detections to JS. JS draws everything.
- Plates: 12 generated in `docs/spatial/plates/` (print PDFs, reference images, registry with planned poses). None mounted yet.
- JS: `apps/mobile/src/features/ar/` holds the localizer (gravity-constrained fix from a plate, confidence decay), the walking-graph router, the projection of building points onto the camera, the AR screen and the 2D floor map screen. Entry: the "AR guide" chip on Home.
- Verified on a real Android phone (OnePlus, Android 15) on 2026-09-27: the floor-3 plate shown on a monitor gave a fix at 0.8 m, the screen read "3rd floor · 90% sure", and room labels projected at plausible places. iOS compiles but is not yet phone-tested.
- Still open: mount and measure the plates, first walk test, floor-change handling (barometer), cloud anchors later.

### Phase 4: AR experiences

- Labels → navigation → building info → documented infrastructure markers → 2D map parity.

### Phase 5: IoT integration

- Device registry, MQTT ingest, latest state, WebSocket fan-out, asset binding, AR and dashboard cards.
- First devices: tank level, pump on/off (cheap ESP32-class hardware, LATER decision).

### Phase 6: Digital Twin

- History, events, maintenance links, model versioning, admin views, analytics hooks.

---

## 13. Minimum work before writing production code

1. **Accept the drawing set as final.** The architect has no more files. The 7 PDFs are the complete
   source. Record them in the model's `drawings` list. Everything they do not show is measured on site.
2. **Use the adopted values** in section 1.10. Nobody needs to be on site for Phase 1.
   Two items stay open and are cheap: a Google Maps pin for lat/lon, and a photo of where the tank,
   pump, meters and main DB are. When someone is on site later, confirm the six assumed values with a tape
   (floor-to-floor at the stair, GF height, plinth, finish thickness, lift door, compass bearing).
3. **Confirm the frame** (section 3.1) or name a different origin.
4. **Produce `building.json`**: typical floor from the vector PDF DONE; GF and 6th from the brochure rasters DONE (v0.1, 2026-09-27). See [spatial/README.md](spatial/README.md).
5. **Validation walk** on one typical floor with the printed model.
6. **Decide the AR stack** (native module vs ViroReact) and whether a Google Cloud project is acceptable for cloud anchors.

Nothing in the AR, IoT or twin layers should start before items 1–5 exist. Everything after them builds on ids and coordinates that will not change.

---

## RECOMMENDED NEXT STEP

Do these two things now, in parallel:

1. **Check the three pictures** in [spatial/](spatial/README.md): typical, sixth and ground floor. Say which room names, flat outlines or parking slots are wrong. That is the validation step for Phase 1.
2. **Print the 12 plates** from [spatial/plates/](spatial/plates/README.md) and mount the lift-landing ones first. Then run the app on a real phone, stand at a landing, and check that the floor and the labels appear.
3. **Report** what the phone shows. The first walk test decides the next fixes (plate poses, confidence limits, label placement).

Decision needed (1):

| # | Decision | Option A | Option B | Recommendation |
| --- | --- | --- | --- | --- |
| D1 | AR stack in the RN app | native ARKit/ARCore module | ViroReact | **DECIDED 2026-09-27: A, native.** Built as the workspace package `packages/ar-native`. |

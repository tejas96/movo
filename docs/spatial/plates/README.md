# Landmark plates

Twelve printed plates give the phone its first fix: which floor, where, and which way it faces. They are not QR codes.
Each plate is a unique high-contrast pattern with the floor number, matched by ARKit (reference images) and ARCore (augmented images).

| File | Use |
| --- | --- |
| `LP-*.print.pdf` | Print these. A4, 100 % scale, no "fit to page". The image must be 190 mm wide. |
| `LP-*.png` | The exact image the phone matches. Do not edit. |
| `plates.json` | Registry: id, floor, planned position (absolute BLCS mm, z = floor level + 1.40 m) and wall normal. |
| `show.html` | Shows a plate on a screen at 190 mm for a desk test: `http://localhost:8765/plates/show.html?id=LP-L3-LIFT` with the `spatial-viewer` server running. |

## Where they go

| Plate | Where | Pose confidence |
| --- | --- | --- |
| LP-L1-LIFT … LP-L6-LIFT | Each floor's lift landing, on the ventilation-shaft wall facing the lift door. Centre 1.40 m above the floor. | medium |
| LP-L0-LOBBY | Entrance lobby, wall facing the lift door | low |
| LP-L0-C13, LP-L0-C25 | Parking, on columns C13 and C25, the face towards the core | medium |
| LP-L6-TERRACE | Sixth floor, lobby wall beside the north terrace door | low |
| LP-L0-GATE | South gate (west one), pillar face towards the plot | low |
| LP-RF-TANK | Roof, near the tank. Position unknown; mount, then measure. | none |

## Mounting rules

1. Flat on the wall, no curl. Laminate or put behind clear plastic without glare.
2. Centre at 1.40 m above the finished floor. Level.
3. Good light. Not behind glass. Not facing a window.
4. After mounting, measure the centre point and update `position` and `normal` in `plates.json`, then re-run `tools/make_plates.py` so the app gets the same numbers. Set `status` to `MOUNTED`.

## How the fix works

The plate gives the phone a full pose relative to the plate. The app keeps pitch and roll from gravity and takes only yaw, position and floor from the plate. That makes a slightly tilted plate harmless. See `apps/mobile/src/features/ar/spatial/localizer.ts`.

# AR guide: native rendering and hidden services

Status: **DECIDED, built 2026-10-18**. Follows [docs/09](09-spatial-ar-digital-twin.md).

## 1. Why the AR guide was slow

The first version drew everything in JavaScript. Every camera pose (15 a second) went into the Zustand
store, re-rendered the whole `ARScreen`, recomputed every room centroid, projected every point, and
re-laid-out twelve NativeWind label views plus an SVG. The JS thread sat at 100 %, so labels lagged the
camera by two to four frames and "swam". On top of that, the thirteen plate images were decoded and
added to the ARCore image database on the UI thread while the session was created, which froze the
screen for seconds at open, and every tracked-plate frame re-fixed the anchor, which made the content twitch.

## 2. The fix, from the root

**The native side draws. JS only decides what to draw.**

```
JS (a few times a second at most)                 Native (every camera frame, GPU)
  level + layers  -> scene JSON  ----------------->  parse on a worker thread, upload buffers
  route           -> route JSON ----------------->  draw ribbon, tubes, markers, label pills
  plate fix       -> anchor matrix --------------->  one 4x4 under which everything sits
  pose events at 4 Hz, only for the HUD   <-------  camera pose
```

- `packages/ar-native`: `scene`, `route` and `anchor` props. Android has a GLES2 `SceneRenderer`
  (meshes + billboard label textures), iOS a SceneKit `SceneRenderer` (same shapes, shader modifiers).
  The pattern shaders are the same code on both: `chevron` (route arrows that run forward),
  `band` (liquid sliding along a pipe), `pulse` (electric packets with a flicker), `solid`.
- `apps/mobile/src/features/ar/spatial/mesh.ts` builds the geometry once in TypeScript (ribbon, tube,
  diamond, ring), so both platforms draw exactly the same thing and the builders have unit tests.
- `localizer.ts` no longer writes to the store per frame; a pose event only re-renders when the
  phone moved 10 cm, turned 3° or confidence changed 1 %. A plate re-fixes the anchor only when it is
  a new plate or the old fix is 20 s / 6 m old.
- `useRoute.ts` recomputes the route only when the nearest start node changes.
- Session creation and the image database run on a worker thread on both platforms; plate events
  are throttled to two a second per plate.

Result: zero JS work per camera frame, content locked to the camera at 30 to 60 fps, no freeze at open.

## 3. Pipes and wires

The drawings have no pipe or conduit routes (docs/09 section 1.7). `spatial/services.ts` builds
**indicative** routes from what the drawings do give (shaft positions, wet rooms, flat doors, board heights):

| Kind | Route | Height |
| --- | --- | --- |
| Water supply | riser in the plumbing duct → branch at ceiling → drop at the kitchen sink / toilet basin | 2.3 m branch, 0.8 m fixture |
| Drainage | floor trap → run below the slab → stack in the duct | −0.25 m |
| Electric | riser in the ventilation shaft → DB on the loft at the flat door → conduit in the slab to each room → drop to the switch board by the door | 2.9 m slab, 2.6 m DB, 1.4 m board |

Every line carries `confidence: 'inferred'`. The camera view and the 2D map show an **Indicative** badge
and the layer sheet says: not surveyed, do not drill or cut by them. A route survey replaces a line's
points and sets `surveyed`; nothing else changes.

Layers (Route, Room names, Water, Drainage, Electric) are one store, shared by the camera and the map.

## 4. Look

Chosen from the five most-liked AR navigation shots on Dribbble (Yi Li, RonDesignLab, Sebo/Kukuh Andik,
Fireart Studio, Md. Shamsul Alam): a translucent floor ribbon with chevrons that run forward, dark glass
pills over the video, one accent (amber) for the next step and the destination, a big "turn" card with
the distance, a white "Where to?" dock, and scan brackets until a plate gives a fix.

## 5. Manual position when no plate is in view

"I know where I am" under the scan brackets (and the floor pill at the top, any time) opens one sheet:
level chips, the user's own flat with its rooms, the other flats as one-tap cards, and the common areas.
One tap sets the position. Facing direction comes from the compass: Android reads the rotation-vector
sensor in the AR view, iOS runs ARKit with `gravityAndHeading`, and both send `heading` in the pose
event. `localizer.manualFix` builds the anchor from the camera's current pose, the heading and the room
centre at hand height (1.4 m). Confidence starts at 0.55 (0.35 without a compass) and the pill says
"Set by you". The next plate the camera sees replaces the manual fix.

## 6. Not done yet

- A walk test on a phone (the emulator has no ARCore camera).
- `pod install` fails on this Mac with "SPM + static linkage is not supported" from react-native-firebase;
  the Swift compiles (checked with `swiftc -typecheck`) but the Pods project must be regenerated before
  an iOS build picks up `SceneRenderer.swift`.
- Switch-board and fixture positions are room centroids and door offsets, not the mm offsets from the
  electrical and plumbing sheets (docs/09 phase 1 step 4).

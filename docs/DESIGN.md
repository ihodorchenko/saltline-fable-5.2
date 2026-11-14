# GLASSLINE — design direction

Status: implemented visual/UI pass on the playable prototype (2026-11-15).

## Concept

**City of Light.** A utopian vertical city where public rooftops are the
circulation layer: pale ceramic, glass and planted terraces under a warm sun.
The runner is the only red element moving through it.

The design borrows the *feeling* of first-person parkour — clean silhouettes,
hard routes, speed — but not any Mirror’s Edge asset, logo, character, level or
interface. All geometry, textures, type treatment and audio in GLASSLINE are
original or procedural.

## Pillars

1. **Read the line.** The route is a red thread across ivory rooftops; every
   checkpoint is a ring plus a floating diamond guide.
2. **A city, not a test map.** Towers, skyline depth, terraces, planters,
   antennas, service props and sun haze sell scale.
3. **Calm interface.** The HUD is an instrument panel, not a wall of text: act,
   checkpoint, timer and one contextual prompt.
4. **Flow before decoration.** The route stays legible at sprint speed; props
   sit off the critical path.
5. **Accessible control.** Separate Settings/Controls, rebindable keys,
   readable contrast and a clear keyboard-only scope.

## Palette

| Token | Hex | Use |
|---|---|---|
| Ink | `#0B0F12` | shell/background, panels |
| Bone | `#F2EEE3` | titles, primary text, rooftop tops |
| Glass | `#D2E1E4` | pale tower faces, platforms |
| Cyan | `#C8EDF5` | window light, cool rim |
| Steel | `#8FA3A9` | secondary text, telemetry |
| Signal | `#D23A39` | route, current checkpoint, primary actions |
| Warm sun | `#FFE2B8` | key light, sun glow |
| Moss | `#78977D` | rooftop planting |

Surfaces use near-white tops and desaturated blue-grey sides; the red route is
the strongest saturation on screen.

## Typography

- **Big Shoulders Display** — boot mark, menu titles, act/stage headings.
- **Barlow Condensed** — premise/supporting copy.
- **IBM Plex Mono** — telemetry, HUD labels, settings, bindings.

No font binaries are bundled; Google Fonts are OFL-licensed and system fallbacks
cover offline play. See [`THIRD_PARTY.md`](THIRD_PARTY.md).

## Screen system

### Boot

`GLASSLINE` wordmark, red rule, `CITY OF LIGHT / ROOFTOP INDUCTION`, progress
line and restrained status copy. The title menu is revealed only after boot, so
the first frame belongs to the world, not the game shell.

### Title / Continue

- full-bleed world behind a left scrim;
- act/checkpoint budget in the meta line;
- primary action: **START RUN** or **CONTINUE**;
- secondary: **START OVER** when a run exists;
- separate **SETTINGS**, **CONTROLS**, **LEVEL INSPECTOR**.

### Settings

Display/audio only: mouse sensitivity, sound on/off, volume, quality note.
No key bindings here.

### Controls

Dedicated keyboard map with conflict rejection and **RESET KEYS**. This keeps
first-run onboarding and remapping as separate mental models.

### HUD

```text
┌ brand / act / stage ─────────────┐        ┌ time ─────────┐
│ progress                          │        │ best          │
│ checkpoint count / respawns       │        │ last split    │
└───────────────────────────────────┘        └───────────────┘

                 [ checkpoint toast ]

        [ contextual prompt ]

 [ R retry · Backspace restart · click view to look ]
```

- top-left: GLASSLINE, act, current stage, progress and checkpoint count;
- top-right: run timer, personal best, last split;
- bottom: one contextual instruction; controller hint bar is suppressed;
- center-top toast on checkpoint/respawn, fading after ~2.2s.

### Pause / complete

Pause: Resume, Restart Run, Settings, Controls, Inspector.  
Complete: time, best, respawns, Run Again, Settings, Controls, Inspector.

## World language

- **Rooftops** are pale ceramic slabs with procedural concrete seams, stains and
  drainage detail, dark board-formed sides, metal fascia and shallow curbs.
- **Surfaces** use a runtime Canvas atlas: concrete, side concrete, glass facade,
  roof membrane, brushed metal, asphalt/street grid and worn red route paint.
  Platform edges get metal fascia, shallow curbs, structural legs, service AC,
  vents, huts, pipes, guard rails, solar arrays and access doors.
- **Route** is a continuous red strip; current checkpoint ring and next-checkpoint
  diamond are red.
- **City** is a deterministic generated district: about 130 near blocks plus
  349 perimeter-ring blocks at high quality, terraced low-rise roofs near the
  route, taller towers behind, cyan window bands, green roofs/trees, four
  skybridges, an elevated diagonal transit line, rooftop service units, three
  original wayfinding signs and a central spire landmark. Explicit start/finish
  clusters frame both ends; concentric horizon rings and a far terminal tower
  close every sightline without turning the finish into a flat facade wall.
  Building footprints are collision-checked against each other, and window bands
  are geometric so they do not stretch with the facade atlas. All city geometry
  is instanced into roughly a dozen draw calls and kept out of the route corridor.
- **Acts**: ascent → descent/second pass → final sprint. Act labels are in-world
  canvas signs; the HUD names the act.
- **Finish** is a red gate and ring on the final roof.

Lighting: warm key + cool blue rim + bright hemisphere, light blue fog and a
procedural sun sprite. The palette stays bright and optimistic; danger is conveyed
by red route language, not darkness.

## Motion / feedback

- landing dip and speed-based FOV;
- slide camera drop; wallrun roll;
- checkpoint ring color progression (red current, green passed, grey upcoming);
- floating next-checkpoint diamond;
- brief checkpoint/respawn toast;
- procedural SFX for steps, jump, land, slide, vault, mantle, wallrun, wallclimb,
  roll, checkpoint, finish and respawn.

## Implementation map

- shell/loading: `src/index.html`, `src/ui/styles.css`
- title/settings/controls/pause/complete: `src/game/glassline/menu.js`
- HUD and checkpoint toast: `src/game/glassline/tutorial.js`, `src/ui/styles.css`
- world palette/material/prop language: `src/levels/build.js`, `src/levels/tutorial.js`
- generated city plan/build: `src/levels/city.js`, `src/levels/city.test.js`
- movement/camera feedback: `src/game/glassline/player.js`
- route/act content: `src/levels/tutorial.js`
- inspector: `src/game/glassline/editor.js`

## Open design work

- final architectural detail pass on the route geometry;
- mobile/touch controls (currently desktop keyboard scope);
- formal contrast audit across all monitor profiles;
- localized copy and accessibility labels for every panel.

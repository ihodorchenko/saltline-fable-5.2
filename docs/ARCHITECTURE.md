# Saltline architecture

Status: Phase 1, P1.2 extraction. `dev` is the integration branch. The source
tree is the source of truth; the root `index.html` remains the legacy parity
baseline.

## Goals

- Keep the original game behaviour and visual output.
- Ship a single self-contained `dist/index.html` for easy local play.
- Replace the minified single file with explicit modules one subsystem at a time.
- Make the engine reusable without importing Saltline gameplay code.
- Prove every extraction against the legacy build (0.0% screenshot diff where
  the scene is deterministic).

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Boot / legacy core | `src/game/main.js` | URL parsing, context creation, module wiring, the retained minified game core and animation loop. |
| Engine | `src/engine/*` | Input, HUD/menu, audio, materials, physics, render, melee, settings and core primitives. Must not import `src/game/`. |
| Game | `src/game/saltline/*` | Saltline flow, content, level layout, weapon, enemies and gameplay HUD rules. |
| Modes | `src/modes/index.js` | Campaign/showcase/bench resolution and the showcase module registry. |
| Shell | `src/index.html`, `src/ui/styles.css` | DOM shell and all UI styles. |
| Build | `vite.config.js` | Vite root at `src/`, single-file output at `dist/index.html`. |

The minified game core is still inside `src/game/main.js`. This is deliberate:
only code whose dependencies can be passed explicitly is extracted. Do not
reformat `src/game/main.js` while it contains the minified core.

## Boot sequence

`src/game/main.js` performs the boot in this order:

1. Parse query parameters and resolve the mode (`campaign`, `showcase` or `bench`).
2. Create the game context: `THREE`, params, event bus, deterministic RNG, time
   state and quality profile.
3. Install render and create the renderer/scene/camera/view camera.
4. Install materials, physics and props.
5. Build the level, backdrop and ground; rebuild physics.
6. Create FX, audio, player, combat and weapon.
7. Normal campaign path: create enemies, HUD, melee and the Saltline game controller.
8. Wait for the first light / renderer readiness, then start the loop.

The normal loop order is:

```text
input
game.update
player
weapon
enemies
melee
weapon wetness
fx / ground / level / backdrop / materials
audio
hud
render.frame
input.endFrame
```

The HUD is updated after gameplay so it presents the state produced by the
current frame.

## Contracts

### Game context

Modules receive a single `game` context. The public fields used by extracted
modules include:

```text
THREE, params, events, rng, time, quality,
render, renderer, scene, camera, viewCamera,
mats, materialsModule, physics, props,
level, ground, backdrop, fx, audio,
player, combat, weapon, enemies, hud, melee, game
```

Engine modules must not assume Saltline-specific fields. Game modules may use the
engine fields they need, but must receive legacy helpers through an explicit
`deps` object.

### Event bus

`createEvents()` in `src/engine/core/events.js` provides synchronous
`on/off/emit`. Handlers are isolated: one throwing handler is logged and does not
stop the rest. Important events include:

```text
game:state, input:lock, player:hit, player:dead, player:hitEnemy,
enemy:alert, enemy:killed, objective:progress, objective:done,
objective:all, extraction:reached, weapon:melee, impact, radio:line
```

### Time

`createTime()` owns `{t, dt, frame, real}`. The loop calls
`advanceTime(time, rawDelta, now, fixedDelta)` exactly once per frame. The
simulation delta is clamped to 0.05 s unless a fixed step is supplied.

### RNG

`createRng(seed)` is the deterministic mulberry32 implementation used by the
legacy build. There is one game RNG; systems that need independent sequences use
`rng.fork()`. Do not call `Math.random()` for gameplay or procedural content.

### Settings and bindings

- `src/engine/settings/index.js` owns defaults, validation, the `v0 -> v1`
  migration and the `saltline.settings.v1` storage key.
- `src/engine/input/bindings.js` owns both `KeyboardEvent.code -> action` and the
  display metadata used by HUD hints and the controls legend.

## Dependency rules

```text
engine/core       -> no game code
engine/*          -> engine/core, browser APIs; never src/game
engine/ui         -> input bindings + settings
game/saltline/*   -> engine/core, content/hud; legacy helpers through deps
modes             -> no game or engine imports
game/main.js      -> engine + game + modes (boot only)
```

`src/game/saltline/game.js` is the main state machine. It imports `createMenu`
from the engine UI and receives the legacy math helpers and quality profiles via
`deps`. Level, weapon and enemies follow the same pattern: they import only
`engine/core` when needed and receive the rest of their Saltline dependencies
from `src/game/main.js`.

## Adding a mode

A showcase mode is a module with `create` and `showcase` functions. The boot
registry in `src/game/main.js` wires the existing level/weapon/enemy modules into
`createModes`. To add a mode:

1. Implement `showcaseMyMode(game)` in the game layer; it should return
   `{ cam, target, update }` when it wants a fixed camera.
2. Create a module object, for example:
   ```js
   const myMode = {
     create: (game) => createMyMode(game, deps),
     showcase: showcaseMyMode,
   };
   ```
3. Add it to the registry passed to `createModes`:
   ```js
   const modes = createModes({ ...existingModules, mymode: myMode });
   ```
4. Open `?show=mymode` and confirm the fatal screen stays empty and the scene
   renders.
5. If the mode should have a separate query alias, resolve it in
   `src/modes/index.js` rather than adding ad-hoc checks in boot.

`campaign`, `showcase` and `bench` are the only mode kinds. `bench` is selected by
`?bench=1` or `#bench`; `?show=` only selects a registered showcase.

## Extracting more of the legacy core

1. Pick one factory or state machine with a clear return value.
2. Compute its free variables (ESLint scope or a one-off AST walk).
3. Move the body to `src/game/saltline/` or `src/engine/` and make those free
   variables explicit imports or `deps`.
4. Wire the original call site to the new factory.
5. Run `npm run check`, `npm run build`, the smoke test and screenshot parity.
6. Only then update the plan and commit.

Avoid moving DOM ids, constants and helper functions at the same time as the
factory. Small, reversible steps are easier to verify.

## Verification

```sh
npm run check
npm run build
SERVE_DIR=dist SMOKE_QUERY='?show=level&q=low' SMOKE_NAME=level npm run smoke
```

Screenshot parity: compare title (`?q=low`), gameplay (`?autostart=1&q=low`) and
level (`?show=level&q=low`) against the legacy baselines with `image_diff`.
The headless browser throttles `requestAnimationFrame`; animation timing should
be tested at module level, not by a fixed headless delay.

## Portability checklist

See [`ENGINE_REUSE.md`](ENGINE_REUSE.md) for the full checklist and a
step-by-step start. Short version:

When reusing the engine in another project:

- copy `src/engine/` and keep its imports inside `src/engine/`;
- provide the `game` context fields the module expects;
- provide a DOM shell with the ids used by `src/engine/ui/` and the stylesheet;
- keep `createEvents`, `createTime` and `createRng` as the shared primitives;
- provide a storage implementation if `localStorage` is unavailable;
- build with the single-file Vite config or inline the emitted assets yourself.

## Working rules

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for branch rules, extraction workflow,
tests, assets and the merge checklist.

## Decision records

- [ADR 0001: engine/game boundaries](adr/0001-engine-game-boundaries.md)
- [ADR 0002: single-file distribution](adr/0002-single-file-distribution.md)
- [ADR 0003: legacy core adapter](adr/0003-legacy-core-adapter.md)
- [ADR 0004: settings and bindings](adr/0004-settings-and-bindings.md)

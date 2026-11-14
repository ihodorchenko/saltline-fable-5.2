# Reusing the engine in another project

This checklist is for a new game that wants Saltline's engine without importing
Saltline gameplay. See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the boundaries and
[`adr/`](adr/) for the decisions behind them.

## 1. Decide what to copy

Copy the engine modules you need:

```text
src/engine/core/        events, time, deterministic RNG
src/engine/input/       bindings and input state
src/engine/settings/    versioned settings
src/engine/ui/          HUD/menu primitives (or provide your own)
src/engine/audio/
src/engine/materials/
src/engine/physics/
src/engine/render/
src/engine/fx/
src/engine/melee/       optional; Saltline-specific melee view-model animation
```

Do **not** copy `src/game/saltline/` unless you want Saltline as a reference.
Do not import `src/game/main.js`; it is boot plus the retained minified core.

## 2. Provide the game context

Engine factories receive a `game` object. The fields used by the standard
modules include:

```text
THREE
params
events          createEvents()
rng             createRng(seed)
time            createTime()
quality
render          renderer/scene/camera/viewCamera
renderer
scene
camera
viewCamera
mats
materialsModule
physics
props
level
ground
backdrop
fx
audio
player
combat
weapon
enemies
hud
melee
game
```

Provide only the fields your chosen modules consume; missing optional modules
must have stubs when the boot path expects them.

## 3. Provide the DOM and styles

The stock UI expects:

- an element with id `ui` for HUD/menu;
- an element with id `view` for the pointer-lock surface;
- the HTML shell ids used by the boot overlay in `src/index.html`;
- `src/ui/styles.css` (or equivalent styles for your own HUD).

If you keep the stock HUD, preserve its ids and class hooks. If you replace it,
keep the HUD API contract: `show`, `setObjective`, `setRelays`, `setMarkers`,
`setPrompt`, `radio`, `clearRadio`, `warn`, `message`, `feed`, `hitmarker`,
`reset`, `update`.

## 4. Keep the primitives shared

- one `createRng(seed)` for gameplay; use `fork()` for independent streams;
- one `createTime()` and one `advanceTime()` call per frame;
- one event bus; emit through the shared bus;
- use `createSettings`/`loadSettings` rather than ad-hoc localStorage keys;
- derive HUD key hints from `input/bindings.js`.

## 5. Build and test

Copy `vite.config.js`, `vite-plugin-singlefile` and the `src/index.html` entry
shape if you want one-file output. Keep:

- a build check (`npm run build`);
- unit tests for RNG, math, bindings/settings and physics queries;
- Playwright boot test with `__errors`/fatal assertions;
- golden screenshots against a stable reference when possible;
- a perf JSON baseline (draw calls, tris, frame time).

The current CI in `.github/workflows/ci.yml` is a working starting point.

## 6. Portability checklist

- [ ] engine imports only `src/engine/*` and browser APIs;
- [ ] no import from `src/game/`;
- [ ] no dependency on minified helper names;
- [ ] all module inputs come from the context or an explicit `deps`;
- [ ] DOM ids and styles are provided or replaced;
- [ ] localStorage access is guarded;
- [ ] deterministic seed and time are wired;
- [ ] boot has stubs for optional modules;
- [ ] build emits one file (or your chosen distribution);
- [ ] a fresh boot has no `__errors`/`__fatal`;
- [ ] unit, browser and golden tests pass;
- [ ] assets are original or licensed and `NOTICE` is preserved.

## 7. What is intentionally not reusable yet

- the minified legacy core inside `src/game/main.js`;
- Saltline-specific flow/content, level layout, weapon, enemies and HUD rules;
- the exact Google Fonts dependency;
- any original Saltline art/audio (rights remain with the original author).

# Saltline — Fable 5.2 FPS

A small browser first-person shooter: one level in a rainy container port. Cut three uplink relays while drones ("Gulls") and robot dogs ("Hounds") hunt you.

<img width="1685" height="906" alt="Saltline" src="https://github.com/user-attachments/assets/8dd32149-90f4-4d69-a573-4411a49a9ba9" />

## Demo

https://realcodebear.github.io/saltline-fable-5.2/ (upstream build; the local control remaps are not deployed there)

## Where it comes from

- Built by **Claude Fable 5.2**. The run was set up by Felix Rieseberg (Anthropic) and shared on X on 2026-11-09:
  https://x.com/felixrieseberg/status/2119925633564463609
- Original playable artifact: https://claude.ai/artifact/BGY1SztrAYcJQHSsnHHGmp
- Per his post: one prompt, no human feedback, about 8 hours, about 2.7M output and 445M input tokens (heavily cached), about $550 at API pricing. Models, sounds and textures are all made in code. These numbers are his own and not checked here.

All credit for the game goes to its original author. This repo is a mirror of the artifact so people can run it locally; local changes are listed below. If you are the author and want it taken down, open an issue.

## Fork status

Phase 1 — build and module extraction — was accepted on 2026-11-13. `dev` is the integration branch; `src/` is the source of truth.

The original root `index.html` is kept as the legacy baseline for parity checks. It is still playable, but it is not the primary entry point and will be retired or moved once automated golden tests cover the source build. `exp/foundation` was merged into `dev` and retired.

**Melee v1** is in `dev` as an intermediate release before Phase 2 (merged from `feat/melee`): **Q**, 1.8 m raycast, 40 damage, 0.8 s cooldown, with a wind-up/strike/recovery rifle-butt animation and fire lockout. See [docs/MELEE.md](docs/MELEE.md).

Phase 1.2 continues on `dev`: core primitives, game state/content, modes, the gameplay HUD adapter, action bindings and versioned settings are extracted. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Controls

| Action          | Binding                      |
| --------------- | ---------------------------- |
| Move            | `W` `A` `S` `D`              |
| Look            | Mouse                        |
| Fire            | Left mouse button or `Shift` |
| Aim             | Right mouse button or `E`    |
| Reload          | `R`                          |
| Cut relay / use | `F`                          |
| Jump            | `Space`                      |
| Sprint          | `X`                          |
| Crouch          | `C` or `Ctrl`                |
| Pause           | `Esc` or `P`                 |
| Melee           | `Q`                          |

Mouse buttons still work as before. Touch controls are shown on touch devices.

## Quick start (source)

Requires Node 22 (see [docs/TOOLCHAIN.md](docs/TOOLCHAIN.md)).

```sh
npm ci
npm run build
python3 -m http.server 8731 --directory dist
```

Then open http://localhost:8731 and click the page to capture the mouse and start the sound.

For development with HMR:

```sh
npm run dev
```

The legacy original is still runnable from the repository root:

```sh
python3 -m http.server 8731
```

It is kept for comparison with the source build, not as the development entry point.

## Development

```sh
npm ci                              # dependencies from package-lock.json
npm run dev                        # Vite dev server + HMR, http://127.0.0.1:5173
npm run build                      # dist/index.html (Vite single-file)
SERVE_DIR=dist npm run smoke       # headless boot check (needs Edge/Chrome)
npm test                           # Vitest unit tests
npm run test:e2e                   # Playwright boot/title/gameplay/level + golden parity
npm run lint                       # ESLint for handwritten JS/config
npm run check                      # lint + prettier --check
```

Node 22 LTS is pinned in `.nvmrc`; system packages are in `Brewfile`; npm versions are in `package.json` and `package-lock.json`.

Source layout:

- `src/index.html` — HTML shell;
- `src/game/main.js` — boot, URL/mode wiring and the retained legacy minified core;
- `src/game/saltline/` — game state machine, flow/content, level, weapon, enemies and gameplay HUD rules;
- `src/modes/` — campaign/showcase/bench resolution and showcase registry;
- `src/engine/core/` — event bus, time and deterministic RNG;
- `src/engine/input/`, `ui/`, `audio/`, `materials/`, `physics/`, `render/`, `melee/`, `settings/` — runtime modules;
- `src/ui/styles.css` — all UI styles;
- `vitest.config.js`, `src/**/*.test.js` — unit tests for core math/RNG/time/events, input/settings/modes;
- `playwright.config.js`, `tests/e2e/` — browser boot/title/gameplay/level tests, physics queries and a source-vs-legacy golden screenshot;
- `docs/` — expansion plan, [architecture](docs/ARCHITECTURE.md), ADRs and toolchain;
- `.github/workflows/ci.yml` — CI: install, lint, unit tests, build, Playwright browser tests on `dev`/`feat/**` and PRs; report artifact uploaded.

ESLint/Prettier cover handwritten JS and config; minified legacy modules, CSS and docs are excluded (see `eslint.config.js` and `.prettierignore`).

## What changed from the artifact

- The claude.ai frame-runtime scripts were removed from `<head>`, and a doctype, charset and viewport tag were added so the file runs as a plain web page.
- Local control remaps: sprint moved from `Shift` to `X`, fire is on `LMB` or `Shift`, aim is on `RMB` or `E`, cut relay moved from `E` to `F`, and melee is on `Q`.
- Phase 1: Vite single-file build, extracted engine modules, split CSS, parity checks, ESLint/Prettier and minimal CI. Title, gameplay and level screenshots match the legacy file at 0.0% diff.
- Melee v1 in `dev`: Q, 1.8 m center raycast, 40 damage, 0.8 s cooldown, 0.48 s rifle-butt state-machine animation, fire lockout, hitmarker/audio/camera kick; no combos yet.

## License

The Phase 1 refactor, module boundaries, build tooling and documentation added in this fork are MIT-licensed; see [LICENSE](LICENSE).

The original Saltline game code, art and audio are mirrored from the original artifact and remain the property of their original author. The MIT license does not apply to that original material; see [NOTICE.md](NOTICE.md).

## Project notes

Technical overview (in Russian): [`docs/OVERVIEW.md`](docs/OVERVIEW.md) — file anatomy, gameplay constants, rendering and audio pipelines, dev hooks, measured numbers, known gaps.
Architecture and decisions: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/adr/`](docs/adr/).

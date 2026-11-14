# GLASSLINE

An original first-person rooftop parkour vertical slice: a three-act tutorial route through a bright, vertical future city, built on the project’s extracted browser engine.

The original Saltline artifact is intentionally preserved at [`index.html`](index.html) as a legacy reference and remains playable. It is not the active build. Its attribution is preserved in [`NOTICE.md`](NOTICE.md).

## Run

```sh
npm install
npm run dev
```

Open the tutorial:

```text
http://127.0.0.1:5173/?show=glassline-tutorial&q=high
```

Or build the single-file artifact:

```sh
npm run build
npm run preview
```

## Controls

- **WASD** move
- **Shift** sprint
- **Space** jump / vault / mantle / wall-jump / wallclimb
- **C / Ctrl** slide, crouch, landing roll
- **A / D** balance
- **R** retry checkpoint
- **Backspace** restart
- **Esc** pause / release mouse
- **F3** performance overlay

The title screen separates **Continue / Start over**, **Settings**, **Controls** and **Level Inspector**. Settings and Controls are independent screens; bindings, sensitivity, audio and checkpoint progress persist locally.

## Project map

- `src/game/glassline/` — playable modes, controller, menu, audio, tutorial flow and editor.
- `src/levels/` — data-driven route, generated city district, builder and validator.
- `src/engine/` — minimal shared engine: core, physics and renderer.
- `tools/bench-glassline.mjs` — headed hardware peak-load benchmark.
- `docs/DESIGN.md` — high-key city concept, materials, HUD and procedural characters.
- `docs/AUDIO.md` — procedural wind, city bed, synth, parkour SFX and radio dispatch.
- `docs/PERFORMANCE.md` — measured draw-call/frame budgets and the 60 FPS profile.
- `docs/GLASSLINE_AUDIT.md` — QA and no-copied-IP audit.
- `docs/THIRD_PARTY.md` — engine/font/dependency notices.

## Verification

```sh
npm run check
npm test
npx playwright test
```

Playwright covers movement, slide, vault, mantle, wallrun, wallclimb, roll, balance, tutorial checkpoints, fail-safe respawn, persistence, UI/settings and performance diagnostics.

## License

GLASSLINE source and generated assets are MIT-licensed as described in [`LICENSE`](LICENSE). The legacy root artifact retains its original ownership/attribution; see the legacy README.

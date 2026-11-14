# GLASSLINE

Phase 2 first-person parkour project. The full plan is in [`PLAN.md`](../../../PLAN.md);
the agent rules are in [`AGENT.md`](../../../AGENT.md).

## Play modes

Tutorial:

```text
?show=glassline-tutorial&q=low
```

Level inspector/preview:

```text
?show=glassline-editor&q=low
```

The tutorial world uses textured platform tops, dark sides, edge lines, lit
skyline windows and rooftop props from `src/levels/build.js`; the level data owns
the palette, scenery and prop placements. The tutorial starts with the GLASSLINE
title/pause/complete shell. Audio is procedural (no samples): a wind bed and pad
plus movement/checkpoint/finish cues; the title/pause menu has sound mute and
volume controls saved locally. Mouse sensitivity is saved under
`glassline.sensitivity.v1`; `R` retries and `Backspace` restarts. Settings include
rebindable movement/action keys, conflict rejection, reset and localStorage
persistence. The inspector is linked from the title screen.

Sandbox for mechanic testing:

```text
?show=glassline&q=low
```

Click the view to capture the mouse. Controls: **WASD** move, **Shift** sprint,
**Space** jump/vault/mantle/wall-jump/wallclimb, **C/Ctrl** slide/crouch/landing roll, **A/D** balance, **Esc** release the mouse. The scene has a rooftop deck, a step,
an obstacle block, a wall, a stepped ramp and a moving platform. Movement uses the
engine `moveCapsule` contract; ledge/coyote queries are exposed for Step 2.
Known limits: the ramp is a stepped collider under a smooth visual, the moving
platform does not carry the player yet, and slide has no dedicated audio/animation
rig yet.

The tutorial uses `src/levels/tutorial.js` data and the shared builder in
`src/levels/build.js`. It is a three-act 203 m route with 21 checkpoints, a station
for each parkour mechanic and a final rooftop sprint. Checkpoints, fall respawn,
finish, stage HUD, timer/splits/best, fail-safe respawn and localStorage progress
live in `src/game/glassline/tutorial.js`. The inspector in
`src/game/glassline/editor.js` provides orbit preview, checkpoint/act focus,
validation, pacing target and JSON export.

## Commands

```sh
npm run dev
npm run build
npm test
npx playwright test tests/e2e/glassline.spec.js

# Automatic CI is disabled during prototyping; the workflow is manual-only
# until the release steps.
```

## Boundaries

- This game lives in `src/game/glassline/`; it must not be imported by engine
  modules.
- Do not import `src/game/saltline/`.
- The reference video is local/untracked; observations live in
  [`docs/REFERENCE.md`](../../../docs/REFERENCE.md).

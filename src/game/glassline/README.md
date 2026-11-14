# GLASSLINE

Phase 2 first-person parkour project. The full plan is in [`PLAN.md`](../../../PLAN.md);
the agent rules are in [`AGENT.md`](../../../AGENT.md).

## Play modes

Tutorial blockout:

```text
?show=glassline-tutorial&q=low
```

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
`src/levels/build.js`. It is a 70 m multi-level route with 10 checkpoints and a
station for each parkour mechanic. Checkpoints, fall respawn, finish, stage HUD,
R retry, Backspace restart and localStorage progress live in
`src/game/glassline/tutorial.js`.

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

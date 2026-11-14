# GLASSLINE

Phase 2 first-person parkour project. The full plan is in [`PLAN.md`](../../../PLAN.md);
the agent rules are in [`AGENT.md`](../../../AGENT.md).

## Step 0 prototype

Open:

```text
?show=glassline&q=low
```

The current scene is intentionally minimal: rooftop deck, first-person-height
capsule, vault block, red route beam and a fixed camera. It is a visual and boot
skeleton, not the movement controller.

## Commands

```sh
npm run dev
npm run build
npm test
npm run test:e2e
```

## Boundaries

- This game lives in `src/game/glassline/`; it must not be imported by engine
  modules.
- Do not import `src/game/saltline/`.
- The reference video is local/untracked; observations live in
  [`docs/REFERENCE.md`](../../../docs/REFERENCE.md).

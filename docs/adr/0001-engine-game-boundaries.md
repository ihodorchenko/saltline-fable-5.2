# ADR 0001: engine/game boundaries

- Status: accepted
- Date: 2026-11-14

## Context

The original game is one minified HTML file. Engine services and Saltline rules
are interleaved, so the renderer, HUD and physics cannot be reused without also
pulling in game state.

## Decision

Split code by ownership rather than by file size:

- `src/engine/` contains reusable services and never imports `src/game/`;
- `src/game/saltline/` contains Saltline rules, content and game-specific HUD
  presentation;
- boot in `src/game/main.js` wires both layers together.

The legacy minified core stays in boot until a subsystem can be moved with an
explicit dependency boundary and parity evidence.

## Consequences

- Engine modules can be copied to another project with a compatible context.
- Game modules need a `deps` object for helpers that still live in the minified
  core.
- The boot file remains larger than a clean application entry point, but every
  extraction is independently reversible and testable.

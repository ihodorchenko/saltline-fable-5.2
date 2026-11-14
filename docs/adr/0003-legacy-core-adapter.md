# ADR 0003: legacy core adapter

- Status: accepted
- Date: 2026-11-14

## Context

De-minifying the whole game at once would be risky and would obscure behaviour
changes behind a very large diff. The extracted modules still depend on helpers,
constants and temp vectors that live in the minified core.

## Decision

Use explicit factories and dependency injection:

- `createSaltlineGame(game, { Zn, kn, sl, Fo, Pr })`
- `createWeapon(game, deps)`
- `createLevel(game, deps)`
- `createEnemySystem(game, deps)`

Modules import only stable engine primitives (`createRng`) and receive the rest
through `deps`. Boot remains the single place that knows about the minified
helpers.

## Consequences

- Extraction diffs are small and parity can be checked after each step.
- The dependency objects are intentionally explicit, even when verbose.
- Free-variable analysis is mandatory before moving a factory; unresolved names
  fail at runtime rather than at build time.

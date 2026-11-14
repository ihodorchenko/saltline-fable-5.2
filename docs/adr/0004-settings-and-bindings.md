# ADR 0004: settings and bindings

- Status: accepted
- Date: 2026-11-14

## Context

Settings and control hints were duplicated in the UI module and the input layer.
Stored settings had no schema version, so future changes could silently break
existing players.

## Decision

- Keep the storage key `saltline.settings.v1` and add an explicit `version: 1`
  marker to new payloads. Unversioned payloads migrate as v0.
- Centralize defaults, clamping and migration in
  `src/engine/settings/index.js`.
- Keep `KeyboardEvent.code -> action` plus display metadata in
  `src/engine/input/bindings.js`. HUD hints and the menu legend derive labels
  from that table; touch/gamepad labels remain platform overrides.

## Consequences

- Existing local settings survive the migration.
- A future schema change adds a migration function instead of changing the
  meaning of an existing key in place.
- Changing a key binding updates input and visible hints from one place.

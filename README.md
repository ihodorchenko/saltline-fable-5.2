# Saltline — Fable 5.2 FPS

A small browser first-person shooter: one level in a rainy container port. Cut three uplink relays while drones ("Gulls") and robot dogs ("Hounds") hunt you.
<img width="1685" height="906" alt="image" src="https://github.com/user-attachments/assets/8dd32149-90f4-4d69-a573-4411a49a9ba9" />

## Demo

https://realcodebear.github.io/saltline-fable-5.2/ (upstream build; the local control remaps are not deployed there)

## Where it comes from

- Built by **Claude Fable 5.2**. The run was set up by Felix Rieseberg (Anthropic) and shared on X on 2026-11-09:
  https://x.com/felixrieseberg/status/2119925633564463609
- Original playable artifact: https://claude.ai/artifact/BGY1SztrAYcJQHSsnHHGmp
- Per his post: one prompt, no human feedback, about 8 hours, about 2.7M output and 445M input tokens (heavily cached), about $550 at API pricing. Models, sounds and textures are all made in code. These numbers are his own and not checked here.

All credit for the game goes to its original author. This repo is a mirror of the artifact so people can run it locally; local changes are listed below. If you are the author and want it taken down, open an issue.

## What changed from the artifact

The claude.ai frame-runtime scripts were removed from `<head>`, and a doctype, charset and viewport tag were added so the file runs as a plain web page.

Local control remaps in this fork: sprint moved from `Shift` to `X`, fire is on `LMB` or `Shift` (the keyboard binding used to be `Enter`), aim is on `RMB` or `E`, and cut relay moved from `E` to `F`; `Q` is no longer bound. Mouse buttons still work as before.

Phase 1 (branch `exp/foundation`): the source moved to `src/` with a Vite single-file build (`dist/index.html`); the legacy root `index.html` remains playable and is the baseline for parity checks.

## Run it

```sh
python3 -m http.server 8731
```

Then open http://localhost:8731 and click the page to capture the mouse and start the sound.

The whole game is one file, `index.html` (~1.4 MB). It bundles three.js and loads fonts from Google Fonts. There are no other outside assets.

## Development (Phase 1)

The legacy single-file game is still `index.html`. The Phase 1 source tree lives in `src/`:

```sh
brew bundle                          # Node 22 on macOS (see docs/TOOLCHAIN.md)
brew link --overwrite --force node@22  # keg-only
npm ci
npm run dev      # Vite dev server + HMR, http://127.0.0.1:5173
npm run build    # dist/index.html (Vite + single-file plugin)
npm run smoke    # headless boot check (needs Edge/Chrome)
npm run lint     # ESLint for handwritten JS/config
npm run check    # lint + prettier --check
```

`SERVE_DIR=dist SMOKE_NAME=dist npm run smoke` checks the built single file; `SMOKE_QUERY` overrides the URL query.

Node 22 LTS is pinned in `.nvmrc`; system packages are in `Brewfile`; npm versions are in `package.json` and `package-lock.json` (see [docs/TOOLCHAIN.md](docs/TOOLCHAIN.md)). `src/` is the source of truth; do not edit the legacy root `index.html`. Vite handles the dev server and HMR; changes to the large game module may trigger a full reload.

ESLint/Prettier are scoped to handwritten JS and config; minified legacy modules, CSS and docs are excluded (see `eslint.config.js` and `.prettierignore`).

GitHub Actions runs `npm ci`, `npm run check` and `npm run build` on pushes to `exp/foundation`/`dev` and on pull requests (`.github/workflows/ci.yml`).

## Project notes

Technical overview (in Russian): [`docs/OVERVIEW.md`](docs/OVERVIEW.md) — file anatomy, gameplay constants, rendering and audio pipelines, dev hooks, measured numbers, known gaps. This note is local to the fork and not part of the original artifact.

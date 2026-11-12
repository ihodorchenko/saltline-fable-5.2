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

## Run it

```sh
python3 -m http.server 8731
```

Then open http://localhost:8731 and click the page to capture the mouse and start the sound.

The whole game is one file, `index.html` (~1.4 MB). It bundles three.js and loads fonts from Google Fonts. There are no other outside assets.

## Project notes

Technical overview (in Russian): [`docs/OVERVIEW.md`](docs/OVERVIEW.md) — file anatomy, gameplay constants, rendering and audio pipelines, dev hooks, measured numbers, known gaps. This note is local to the fork and not part of the original artifact.

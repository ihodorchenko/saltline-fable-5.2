# GLASSLINE — procedural audio

All GLASSLINE audio is synthesized at runtime with Web Audio. No samples,
recordings or third-party music are shipped.

## Layers

1. **Wind bed + city bed** — looping band-passed wind plus a low-passed
   traffic/HVAC rumble with a slow swell. Speed opens the wind band and raises
   its level; the final roof moves it to a broader, louder gust while the pad softens.
2. **Ambient synth** — detuned low saw/triangle drone plus A2/E3/A3 pad voices,
   low-pass filtered and subtly modulated by an LFO. Speed opens the low-pass
   filter for a brighter, more propulsive run.
3. **Parkour SFX** — short filtered-noise and sine transients for footsteps,
   jump, land, slide, vault, mantle, wallrun, wallclimb, roll, checkpoint,
   finish and respawn. Footsteps add a low body thump; slides use a longer
   layered friction tail. Landings are a two-hit heel/toe synth with a low
   concrete boom and cloth rustle, scaled from fall speed.
4. **Intro dispatch** — a short synthesized radio chirp plus a readable
   on-screen dispatch line after the first Start click. Browser speech synthesis
   was removed because its voice, accent and intelligibility vary by OS; the
   subtitle carries the line reliably without downloaded voice files.
5. **UI cues** — short synthesized confirmation tones.

## Controls

- Audio starts only after a user gesture (Start/Continue), respecting browser
  autoplay policy.
- Settings exposes sound on/off and master volume; both persist in
  `glassline.audio.v1`.
- Muting silences the radio chirp and all music/SFX.
- `audioMotion(speed, finale)` is a pure mixing function with unit coverage.

## Files

- `src/game/glassline/audio.js` — audio graph, SFX, dynamic mix and dispatch.
- `src/game/glassline/audio.test.js` — volume/mix unit tests.
- Event wiring: `src/game/glassline/tutorial.js`.

## Constraints

- No Mirror’s Edge audio, music or character voice is reproduced.
- The dispatch line is an original GLASSLINE courier instruction.
- Dispatch is text + radio cue; no unpredictable TTS voice is required for
  narrative clarity.

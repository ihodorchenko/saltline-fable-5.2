# GLASSLINE — procedural audio

All GLASSLINE audio is synthesized at runtime with Web Audio. No samples,
recordings or third-party music are shipped.

## Layers

1. **Wind bed** — looping filtered noise, band-passed around 300–730 Hz.
   Speed opens the band and raises its level; the final roof moves it to a
   broader, louder gust while the pad softens.
2. **Ambient synth** — detuned low saw/triangle drone plus A2/E3/A3 pad voices,
   low-pass filtered and subtly modulated by an LFO. Speed opens the low-pass
   filter for a brighter, more propulsive run.
3. **Parkour SFX** — short filtered-noise and sine transients for footsteps,
   jump, land, slide, vault, mantle, wallrun, wallclimb, roll, checkpoint,
   finish and respawn. Footsteps add a low body thump; slides use a longer
   layered friction tail.
4. **Intro dispatch** — browser `speechSynthesis` says an original courier line
   after the first Start click, preceded by a short synthesized radio chirp.
   No downloaded voice files. If speech synthesis is unavailable, the chirp
   still plays and the game continues silently.
5. **UI cues** — short synthesized confirmation tones.

## Controls

- Audio starts only after a user gesture (Start/Continue), respecting browser
  autoplay policy.
- Settings exposes sound on/off and master volume; both persist in
  `glassline.audio.v1`.
- Muting cancels a speaking dispatch line.
- `audioMotion(speed, finale)` is a pure mixing function with unit coverage.

## Files

- `src/game/glassline/audio.js` — audio graph, SFX, dynamic mix and dispatch.
- `src/game/glassline/audio.test.js` — volume/mix unit tests.
- Event wiring: `src/game/glassline/tutorial.js`.

## Constraints

- No Mirror’s Edge audio, music or character voice is reproduced.
- The dispatch line is an original GLASSLINE courier instruction.
- Browser voice availability, accent and quality vary by OS; it is optional
  atmosphere, not a story dependency.

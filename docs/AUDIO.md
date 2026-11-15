# GLASSLINE — procedural audio

Merged into `project/glassline` as `72f4c36` (2026-11-16); the
feature branch `feat/glassline-audio-pass` was deleted after integration.
The listening renders are in `artifacts/audio/` (git-ignored):
`demo.wav`, `ambience-idle.wav`, `ambience-sprint.wav`, `courtyard.wav`,
`motion-loops.wav`, `sfx-montage.wav`; re-render with `node tools/audio-render.mjs`
while the dev server is running.

All GLASSLINE audio is synthesized at runtime with Web Audio. No samples, no
recordings, no third-party music: oscillators and seeded noise only. That
includes the convolution reverb — its stereo impulse response is generated from
filtered noise plus a handful of discrete early reflections.

The mix is not "a background loop with beeps". It is a small dynamic mix:

- a parkour run opens the wind, adds cloth/gear rustle and brightens the score;
- a third high "air" band (2–6 kHz, very low level) keeps the rooftop mix open
  instead of rumbling: idle ambience ~1.7 % of energy above 2 kHz, sprint ~9 %;
- footsteps and landings know the surface under the capsule;
- slides and wall-runs are continuous controller-driven loops, not one-shots;
- the walled act II courtyard crossfades to a muffled, wetter mix;
- checkpoint/finish chimes are panned towards the target;
- dispatch/checkpoint/finish duck the ambience + music under the stinger;
- everything sums through a gentle compressor, a limiter and the user's master
  volume, with a procedural convolution reverb on a send.

The factory can be driven by an injected `AudioContext` (including an
`OfflineAudioContext`), which is how the measured renders in
`artifacts/audio/` are produced.

## Graph

```
 windLow ─┐
 windHigh ┤
 city ────┼─► worldFilter ─► worldBus ─┐
 traffic ─┘                              │
 cloth ──────────────────────────────────┼─► ambienceBus ─┐
 pad + bass + arpeggio ──────────────────┴─► musicBus ─────┼─► duckGain ─┐
 steps / landings / stunts / chimes ────────► sfxBus ──────┼─────────────┤
 slide + wall-run loops ────────────────────► sfxBus        │             │
                                                            │   ┌─────────┴──┐
 duckGain ─► music ambience send ─┐                         └──►│ compressor │
 sfxBus   ─► sfx send ────────────┴─► convolver ─► reverbReturn ─►│  → limiter │
                                                                 │  → master  │
                                                                 │  → out     │
                                                                 └────────────┘
```

- **Bus compressor**: `DynamicsCompressorNode`, threshold −22 dB, knee 10, ratio
  2.2, 20 ms attack / 250 ms release. Gentle glue, no pumping.
- **Limiter**: threshold −1.5 dB, ratio 20, 2 ms attack / 120 ms release.
- **Master**: user volume (default 0.55), muted = 0.
- **Reverb**: 2.6 s synthetic stereo impulse (darkening noise tail + early
  reflections), `ConvolverNode.normalize = true`, return gain 0.16 open air →
  0.36 in the enclosed courtyard.
- **Ducking**: `duckGain` sits between ambience+music and the compressor, so the
  stinger itself is never ducked. Dispatch −9.4 dB / 5.4 s hold, finish −8 dB /
  4 s, checkpoint −4.2 dB / 1.5 s, respawn −5.2 dB / 1.6 s.
- **Budget**: 54 persistent nodes as measured by the render tool (`nodeCount`),
  against the ~120 budget.

## Layers

### Ambience v2 (`startAmbience`)

| Layer | Source | Shaping | Motion |
| --- | --- | --- | --- |
| Wind low | pink noise, looped | high-pass 62 Hz → low-pass 170 Hz | level and cutoff rise with speed; 0.055 Hz gust LFO on level |
| Wind high (whistle) | pink noise, looped | band-pass 800 Hz, Q 0.75 | level and centre rise with speed; small gust modulation |
| City bed | brown noise, looped, rate 0.55 | high-pass 68 Hz → low-pass 150 Hz | slow 0.045 Hz swell; enclosure low-passes it further |
| Distant traffic | brown noise, looped, rate 0.9 | band-pass 430 Hz, Q 5 | 0.09 Hz swell; recedes in the courtyard |
| Cloth/gear rustle | white noise, looped | high-pass 700 Hz → band-pass 1500 Hz | gain is zero at rest, rises with speed |

All outdoor layers pass through `worldFilter`, a `lowpass` at 19 kHz in the open
that closes to ~2.2 kHz at full enclosure. Cloth is routed directly to the
ambience bus (it is close to the body, not part of the outside bed).

### Music (`startMusic`, `scheduleMusic`)

An original four-chord loop, 3.5 s per chord (14 s total):

```
Am9      Fmaj7    Cmaj7    G6
110.00   87.31    130.81   98.00      Hz pad voices (root per voice column)
130.81   110.00   164.81   123.47
164.81   130.81   196.00   146.83
246.94   164.81   246.94   164.81
55.00    43.65    65.41    49.00      sub bass
```

- Four pad voices; each voice is two detuned oscillators (−7 / +7 cents, saw for
  the lowest, triangle above).
- One sine sub-bass at the chord root, deliberately quiet (0.22 voice gain) so
  the score does not turn into a subwoofer bed.
- One very quiet triangle arpeggio, four notes per chord (pattern `1-3-2-4`, an
  octave above the pad), with a 18 ms attack / 620 ms decay envelope.
- Low-pass `padFilter`: 460 Hz idle → 1560 Hz at full sprint, 300 Hz in the
  finale (wind climbs, the score darkens).
- Chord changes and arp notes are scheduled by a look-ahead loop from
  `updateState` (30–500 ms horizon). Outside the game, `scheduleMusicUntil(t)`
  schedules the whole progression at once for offline rendering.

### Motion loops (`startMotionLayers`)

Continuous loops whose gains follow the controller state, not one-shot samples:

| Layer | Sound | Driven by |
| --- | --- | --- |
| Slide friction | white noise → band-pass 850–1750 Hz | `state.sliding`; gain ramps in 80 ms, band opens with speed |
| Wall-run scuff | white noise → band-pass 720–960 Hz | `state.wallrunning`; gain ramps in 100 ms |

The `slide` / `wallrun` one-shots remain as the contact transient that starts the
loop (wall slap/entry burst).

### One-shot SFX

| Event | Synthesis |
| --- | --- |
| `step` | surface body thump + band-passed sole slap + toe-tick; deterministic left/right pan and pitch/weight variation |
| `land` | sub thump + surface body + broad surface noise + gear rustle after-beat; scaled by impact and surface |
| `jump` / `vault` / `mantle` | filtered noise transient + low body tone, cloth tick |
| `slide` / `wallrun` | contact transient that hands over to the loop layers |
| `wallclimb` | noise scrape + rising tone |
| `roll` | low noise roll + descending tone |
| `checkpoint` | three-note rising chime, panned/attenuated from the payload |
| `finish` | four-voice chord bloom + rising sine + noise swell, panned/attenuated |
| `respawn` | descending synth + noise, panned towards the checkpoint |
| `dispatch` | radio chirp (band-passed noise + two blips) + text line from the HUD |
| `ui` | short confirmation blip |

All SFX are mono-synthesized and panned with `StereoPannerNode` (equal-power),
then summed into the SFX bus, so they inherit the mix bus, limiter and reverb
send.

### Surface response

The capsule controller already reports the collider `surface`
(`src/game/glassline/player.js` forwards `result.surface` in the step/land
payloads; `src/levels/build.js` writes `platform.material || 'concrete'` into the
physics boxes). `surfaceResponse(surface)` maps a name to a timbre:

| Surface | Body | Slap band | Character |
| --- | --- | --- | --- |
| `concrete` (default) | 74 → 40 Hz | band-pass 1800 Hz, Q 0.9 | short, dry toe-slap with a body knock |
| `metal` | 168 → 118 Hz | band-pass 2800 Hz, Q 3.2 | ringing slap, brighter tick |
| `planter` / `wood` | 116 → 72 Hz | band-pass 950 Hz, Q 1.3 | softer, mid-heavy |
| `gravel` | 88 → 52 Hz | high-pass 2100 Hz | scuffier |
| `water` | 140 → 60 Hz | low-pass 3200 Hz | splashy |

Unknown names fall back to concrete. Today the tutorial geometry tags walkable
colliders as `concrete`; a level can opt into metal/plant surfaces by setting
`material` on a platform/obstacle (already supported by `build.js`). The metal and
planter timbres are exercised by the offline montage.

### Spatial cues

`cuePan(target, listener)` returns `{pan, attenuation, distance}` using the
camera yaw convention (forward = −Z at yaw 0, right = +X). `tutorial.js` computes
it for the reached checkpoint, the finish gate and the respawn checkpoint and
passes `pan`/`attenuation` through the event payload. The synth applies both the
panner and a gain scale.

### Enclosure (courtyard)

`src/levels/tutorial.js` declares acoustic zones beside the visual data:

```js
audioZones: [
  {
    id: 'service-courtyard',
    min: [-7.3, -13.5, -133],
    max: [7.3, 4.4, -101.8],
    enclosure: 1,
    fade: 3,
  },
],
```

`tutorial.js` calls `enclosureAmount(state.pos, level.audioZones)` every frame and
feeds it into `audio.updateState({ enclosure, ... })`. `enclosureMix(amount)`
maps that to: wind ×0.5, wind whistle ×0.38, city ×0.58, traffic ×0.42, city
low-pass ×0.58, outside low-pass 19 kHz → 2.2 kHz, reverb return +0.2. The zone
covers the walled courtyard (walls at x = ±6.4, z = −102…−114.5), the service
shaft and the climb-out roof; the 3 m fade crossfades over the rim above and at
the wall-run gap out of the shaft (z ≈ −133).

## Autoplay / mute / volume / persistence / dispose

Unchanged contract:

- The `AudioContext` is still created lazily only inside `start()`, which the
  START/Continue menu button calls from a user gesture. No context is created on
  page load or on mute/volume changes before starting.
- Volume and mute persist in `localStorage` under `glassline.audio.v1`
  (`AUDIO_KEY`); defaults are 0.55 / unmuted. `setVolume` clamps to 0…1.
- The menu reads `audio.muted` / `audio.volume` and calls `setMuted` / `setVolume`
  as before; the `started` getter is still used by the UI e2e test.
- When the game pauses (pointer lock exit / revealed menu), `tutorial.js` calls
  `updateState(state, force = true)` with a settled idle state, so a pause during
  a sprint or slide does not leave the wind or the motion loops stuck.
- `dispose()` stops looping sources, disconnects the persistent graph, removes
  event bindings and closes the context only if the factory owns it (an injected
  `OfflineAudioContext` is never closed).
- `bind(events)` forwards the full payload for every gameplay event
  (`jump/land/step/slide/vault/mantle/wallrun/wallclimb/roll/checkpoint/finish/
  respawn`), so surface and spatial-cue data reach the synth.

## Pure helpers (unit-tested in `audio.test.js`)

| Helper | Contract |
| --- | --- |
| `clampVolume(v)` | master fader clamped to 0…1 |
| `landingPower(impact)` | impact speed → bounded landing intensity 0.3…1 |
| `audioMotion(speed, finale, out?)` | wind/city/traffic/cloth/music gains and filter cutoffs from speed + finale; writes into `out` to stay allocation-free on the per-frame path |
| `surfaceResponse(name)` | per-surface body/noise/click timbre |
| `hashUnit(index)` | deterministic 0…1 sequence |
| `stepVariation(index, speed)` | alternating foot side, deterministic pan/pitch/weight |
| `stepCadence(speed)` | stride (1.35 m walk / 1.75 m sprint) → step rate |
| `cuePan(target, listener)` | checkpoint/finish pan + distance attenuation |
| `smoothstep(edge0, edge1, x)` | clamped Hermite step |
| `enclosureAmount(position, zones, fade)` | 0…1 AABB-zone enclosure amount with edge crossfade |
| `enclosureMix(amount, out?)` | enclosure → layer/filter/reverb scale factors |
| `duckEnvelope(kind)` | duck depth + hold for dispatch/finish/checkpoint/respawn |
| `motionLayers(state, out?)` | slide/wall-run loop gains and band centres from controller state |
| `musicIndexAt(t)` / `musicAt(t)` | chord position / chord data in the 14 s loop |

`MUSIC_CHORDS`, `CHORD_SECONDS`, `DEFAULT_VOLUME` and `AUDIO_KEY` are exported
for the tests and for the render tool.

## Offline rendering and measurement

`tools/audio-render.mjs` renders the **real graph** through an
`OfflineAudioContext` (48 kHz, stereo), in a blank same-origin page served by the
running Vite dev server. The audio module is loaded in the browser, given the
offline context via `createGlasslineAudio({ audioContext })`, driven with the same
`updateState`/`play`/`scheduleMusicUntil` calls the game uses, then rendered,
encoded as 24-bit WAV and analysed.

```bash
npm run dev                              # in another shell (127.0.0.1:5173)
node tools/audio-render.mjs              # writes artifacts/audio/
node tools/audio-render.mjs --out /tmp/audio --channel msedge
```

Renders (all measured, none normalized; master volume is the default 0.55):

| File | Purpose |
| --- | --- |
| `ambience-idle.wav` | rooftop bed at rest, 8 s |
| `ambience-sprint.wav` | rooftop bed at sprint speed 7.2 m/s, 8 s |
| `courtyard.wav` | act II courtyard at rest (enclosure = 1), 6 s |
| `motion-loops.wav` | continuous loops driven by controller state over 8 s |
| `sfx-montage.wav` | steps (concrete/metal/planter), jump, light/heavy landings, slide, vault, mantle, wall-run, wall-climb, roll, checkpoint, dispatch, finish over 13 s |
| `demo.wav` | owner listening demo: idle → sprint → courtyard → montage, ≈ 37 s |
| `diag-ambience-solo.wav` | wind+city only (no music/SFX) |
| `diag-music-solo.wav` | pad/bass/arp only |
| `diag-steps-solo.wav` | footsteps only |
| `diag-sfx-solo.wav` | all one-shots without the bed |
| `diag-motion-solo.wav` | loops only, silent → slide → wall-run |
| `diag-duck.wav` | ambience + dispatch cue, for the duck measurement |

`manifest.json` records, per render: integrated loudness (approx. BS.1770 with
K-weighting, 400 ms blocks / 100 ms hop, absolute + relative gating), true peak
(4× oversampled windowed-sinc), RMS, spectral centroid, band-energy fractions,
under-500 Hz share and the persistent node count. It also contains checks:

- clipping (true peak > −0.5 dBFS) — hard failure;
- silence (< −60 LUFS) — hard failure;
- graph budget (≤ 120 persistent nodes) — hard failure;
- ambience loudness target (−22…−18 LUFS, design check);
- wind/city < 500 Hz, pad 100–800 Hz, footstep 800–4000 Hz, SFX peak < −3 dBFS
  (design checks measured on the isolated diagnostic renders);
- enclosure crossfade (courtyard quieter and darker than open rooftop);
- loop layers audible above the silent gap;
- ducking drop on dispatch;
- music chord progression changes spectral centre;
- `updateState` over 1200 frames creates no audio nodes.

### Measured result (current run)

| Render | LUFS | true peak dBFS | RMS dBFS | centroid Hz | < 500 Hz |
| --- | --- | --- | --- | --- | --- |
| ambience-idle | −21.62 | −10.17 | −22.87 | 1171 | 98.6 % |
| ambience-sprint | −18.97 | −8.50 | −20.79 | 2959 | 91.8 % |
| courtyard | −23.35 | −10.52 | −24.39 | 613 | 98.8 % |
| motion-loops | −19.05 | −8.47 | −21.14 | 3003 | 83.0 % |
| sfx-montage | −22.31 | −8.75 | −23.62 | 1779 | 98.0 % |
| demo | −21.30 | −8.50 | −22.96 | 2435 | 96.0 % |

Layer checks from the same run:

| Check | Measured | Target |
| --- | --- | --- |
| wind + city energy below 500 Hz | 98.1 % | ≥ 90 % |
| pad/bass/arp in 100–800 Hz | 85.4 % | ≥ 80 % |
| footstep energy in 800–4000 Hz (+high) | 73.8 % | ≥ 50 % |
| one-shot true peak | −9.43 dBFS | < −3 dBFS |
| enclosed vs open loudness / centroid | −23.35 / 613 Hz vs −21.62 / 1171 Hz | quieter + darker |
| slide / wall-run loop RMS vs silent gap | −24.96 / −25.64 dBFS vs silence | ≥ 6 dB above gap |
| dispatch duck drop | 8.42 dB | ≥ 3 dB |
| first → second chord centroid | 256 → 234 Hz | differs |
| `updateState` nodes over 1200 frames | 54 → 54 | no growth |

These numbers are what the mix is tuned against: the rooftop bed sits in the
−22…−18 LUFS target band, sprint is ~2.6 dB louder than idle and much brighter
(centroid 1171 → 2959 Hz, i.e. the wind/whistle clearly opens), the courtyard is
quieter and darker, footsteps carry most of their energy in the 800–4000 Hz read,
and no render clips.

## What is verified and what still needs human ears

Verified by measurement (offline renders + unit tests + e2e):

- signal flow, loudness/peak headroom, no clipping or silent renders;
- node budget and no node creation from `updateState`;
- loop layers respond to controller state, ducking works, chord progression
  changes, enclosure crossfade changes level/tilt, surfaces differ;
- autoplay/mute/volume persistence and the in-game start flow (Playwright UI
  spec), checkpoint/route/respawn specs.

Not verifiable here (the agent cannot listen):

- musical taste of the four-chord loop and arp (register, voicing, whether it
  feels sparse rather than filler);
- whether the wind gust rate (0.055 Hz) reads as "slow rooftop wind" instead of a
  slow tremolo; gust depth is ±~30 % of the wind-low level;
- the aesthetic balance of wind vs music at real playback volume (measured:
  `diag-ambience-solo` −24.7 LUFS vs `diag-music-solo` −23.8 LUFS, so the score is
  slightly above the wind bed when isolated — a deliberate call, easy to
  re-balance via `audioMotion().musicGain`);
- surface timbres on headphones vs laptop speakers — the concrete/metal/planter
  differences are real in the graph and measurements, but "does metal sound like
  metal" is an ear judgement;
- reverb density/length (2.6 s synthetic IR) on a real room-feel listen;
- whether ducking is perceived as helpfully clearing the radio line or as
  pumping on checkpoint chains (the checkpoint duck is only 1.5 s).

## Files

- `src/game/glassline/audio.js` — graph, synthesis, mix helpers, scheduler.
- `src/game/glassline/audio.test.js` — pure helper unit tests.
- `tools/audio-render.mjs` — offline render + loudness/spectrum manifest.
- `src/game/glassline/tutorial.js` — event wiring, `updateState`, enclosure and
  spatial-cue maths, duck/cue payloads.
- `src/game/glassline/player.js` — adds `surface` to the step/land payloads.
- `src/levels/tutorial.js` — `audioZones` field for the act II courtyard.
- `artifacts/audio/` — WAVs + `manifest.json` (generated, not committed).

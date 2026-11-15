# Reference material — local only

The owner provides video references for look, motion, audio and level-design study.
They are third-party recordings: **never commit them, never copy frames or audio
into the game or into committed docs**. This folder holds:

| Path | What it is | Committed? |
| --- | --- | --- |
| `*.mp4`, `*.mov` | owner-provided reference videos | no (git-ignored) |
| `<video>-kit/` | generated analysis library for a video (see below) | no (git-ignored) |
| `README.md` | this guide | yes |
| `PROLOGUE-ANALYSIS.md` | written analysis of the prologue + training walkthrough, with timestamps | yes (text only) |
| `PROLOGUE-BACKLOG.md` | the implementation backlog distilled from it (P1 props, P2 level structure, P3 life/finish) | yes |
| `../visual-gap/metrics*.json` | numeric profiles derived from reference frames (no imagery) | yes |

## The kit

`tools/reference-kit.py` turns a long video into a browsable, indexed library:

```bash
PY=/Users/igorhodorchenko/.dsh/dsh-runtimes/dsh-primary-runtime/dependencies/python/bin/python3
$PY tools/reference-kit.py \
  --video "docs/reference/<name>.mp4" \
  --out   docs/reference/<name>-kit \
  --fps 1 --step 10
```

It writes (all git-ignored):

| File | Contents |
| --- | --- |
| `metadata.json` | ffprobe summary: resolution, fps, duration, codecs, bitrates |
| `shots.csv` | scene-cut list: index, start/end, duration, mean luma, motion |
| `cuts.json` | raw scene-cut timestamps |
| `frames/` | 1 fps thumbnails named `tHHMMSS.jpg` |
| `sheets/sheet-NNN.jpg` | contact sheets (36 frames each) with timestamp captions |
| `keyframes/` | full-frame stills at every shot start and every 10 s |
| `frames.json` | thumbnail → timestamp → shot index |
| `audio/audio.wav` | source audio, 44.1 kHz stereo |
| `audio/loudness.csv` | short-term RMS/peak every 0.5 s |
| `audio/spectrogram.png` | log-frequency spectrogram of the take |
| `audio/profile.json` | band-energy shares, dynamics, speech-likeness |
| `audio/segments.json` | the same profile per chosen segment (see analysis doc) |

Add `--reuse` to re-use extracted thumbnails when re-running.

## Metric profiles

`tools/image-metrics.py` can measure any reference video with the same 37-metric
harness used for the visual-gap audit:

```bash
$PY tools/image-metrics.py \
  --video "docs/reference/<name>.mp4" \
  --timestamps "115,125,150,505,520,600,720" \
  --classes-json /tmp/classes.json \
  --scratch-dir /tmp/profile-<name> \
  --out-json docs/visual-gap/metrics-<name>.json --no-sheets
```

`--classes-json` maps `timestamp -> [class, note]` (classes such as
`gameplay_outdoor`, `gameplay_interior`, `cutscene`; cutscenes are excluded from
the gameplay aggregate). The produced JSON holds the reference profile, the
per-image numbers and the comparison against the current build screenshots.

## Study library

For focused study a kit also has a hand-curated `study/` folder (built with the
`ffmpeg` one-liner in the analysis doc, or by adding chapters to that script):

| Folder | Contents |
| --- | --- |
| `study/01-titles/` | logos, title cards, end card |
| `study/02-intro-cutscene/` | cinematic camera language |
| `study/03-movement-training/` | the training course, one frame per beat |
| `study/04-combat-training/` | combat tutorial (not needed for GLASSLINE) |
| `study/05-prologue-roofs/` | the mission proper: rooftops, glass, props |
| `study/06-prologue-interiors/` | service corridors, lockers, stairs, skylights |
| `study/07-props-materials/` | prop and material close-ups |
| `study/index.csv` | chapter, file, timestamp, description for every still |
| `study/<chapter>-sheet.jpg` | contact sheet per chapter |

## Rules

- Reference **imagery and audio stay local**. Committed docs describe what was
  observed with timestamps; they never embed frames or sound.
- Study, do not copy: no traced layouts, no reproduced textures, no sampled or
  transcribed audio/music. GLASSLINE must remain original work.
- When a reference teaches a number (luma, contrast, loudness, band balance),
  record it in `../visual-gap/metrics*.json` or in the analysis doc so the whole
  team works from the same target.

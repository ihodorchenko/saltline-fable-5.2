#!/usr/bin/env python3
"""Reference-video kit: turn a long reference video into a browsable, indexed
library so it can be studied frame by frame.

Produces, under --out (a git-ignored folder):

  metadata.json      ffprobe summary (video + audio streams, duration, fps)
  shots.csv          scene-cut list: index, start, end, duration, mean luma, motion
  frames/            1 fps thumbnails (320 px wide) named by timestamp tHHMMSS.jpg
  sheets/            contact sheets (36 thumbs each) with timestamp captions
  keyframes/         full-frame stills at every shot start plus one per 10 s
  audio/audio.wav    the source audio (44.1 kHz stereo)
  audio/loudness.csv short-term RMS/peak per 0.5 s window (dBFS)
  audio/spectrogram.png  log-frequency spectrogram of the whole video
  audio/profile.json band-energy / dynamics profile of the whole video
  frames.json        index joining thumbnails -> timestamps -> shot ids

Usage:
  python3 tools/reference-kit.py --video "docs/reference/x.mp4" --out docs/reference/x-kit
  python3 tools/reference-kit.py --video ... --out ... --fps 2 --scene 0.35 --step 5
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import re
import shutil
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, capture_output=True, text=True, **kwargs)


def ffprobe(path: Path) -> dict:
    out = run([
        "ffprobe", "-v", "error", "-show_format", "-show_streams",
        "-of", "json", str(path),
    ]).stdout
    data = json.loads(out)
    streams = []
    for stream in data.get("streams", []):
        keep = {
            key: stream.get(key)
            for key in (
                "index", "codec_type", "codec_name", "width", "height",
                "r_frame_rate", "avg_frame_rate", "duration", "bit_rate",
                "sample_rate", "channels", "pix_fmt", "color_space",
            )
            if stream.get(key) is not None
        }
        streams.append(keep)
    fmt = data.get("format", {})
    return {
        "file": path.name,
        "size_bytes": int(fmt.get("size", 0) or 0),
        "duration": float(fmt.get("duration", 0) or 0),
        "bit_rate": int(fmt.get("bit_rate", 0) or 0),
        "streams": streams,
    }


def scene_cuts(path: Path, threshold: float) -> list[float]:
    """Return cut timestamps from ffmpeg's scene score."""
    command = [
        "ffmpeg", "-hide_banner", "-i", str(path), "-an",
        "-vf", f"select='gt(scene,{threshold})',metadata=print:file=-",
        "-f", "null", "-",
    ]
    result = subprocess.run(command, capture_output=True, text=True)
    cuts = sorted({
        round(float(match.group(1)), 3)
        for match in re.finditer(r"pts_time:([0-9.]+)", result.stdout)
    })
    if not cuts or cuts[0] > 1.0:
        cuts.insert(0, 0.0)
    return cuts


def extract_thumbs(path: Path, out: Path, fps: float, width: int, duration: float) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(path),
        "-an", "-vf", f"fps={fps},scale={width}:-2", "-q:v", "3",
        str(out / "t%05d.jpg"),
    ])
    files = sorted(out.glob("t*.jpg"))
    return files


def timestamp_name(seconds: float, fps: float) -> str:
    total = int(round(seconds))
    return f"t{total // 3600:02d}{(total % 3600) // 60:02d}{total % 60:02d}"


def label_for(index: int, fps: float) -> str:
    seconds = index / fps
    total = int(seconds)
    return f"{total // 60:02d}:{total % 60:02d}"


def font(size: int):
    for candidate in (
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if os.path.exists(candidate):
            try:
                return ImageFont.truetype(candidate, size)
            except Exception:
                continue
    return ImageFont.load_default()


def make_sheets(frames: list[Path], out: Path, fps: float, cols: int, rows: int,
                thumb_width: int) -> list[dict]:
    out.mkdir(parents=True, exist_ok=True)
    sheets = []
    per_sheet = cols * rows
    caption = 18
    sample = Image.open(frames[0])
    cell_w, cell_h = sample.size
    for sheet_index in range(0, math.ceil(len(frames) / per_sheet)):
        chunk = frames[sheet_index * per_sheet:(sheet_index + 1) * per_sheet]
        width = cols * cell_w
        height = rows * (cell_h + caption)
        sheet = Image.new("RGB", (width, height), (14, 16, 19))
        draw = ImageDraw.Draw(sheet)
        for slot, frame_path in enumerate(chunk):
            x = (slot % cols) * cell_w
            y = (slot // cols) * (cell_h + caption)
            sheet.paste(Image.open(frame_path), (x, y))
            frame_number = frames.index(frame_path)
            draw.text((x + 4, y + cell_h + 2), label_for(frame_number, fps),
                      font=font(13), fill=(235, 235, 230))
        sheet_path = out / f"sheet-{sheet_index + 1:03d}.jpg"
        sheet.save(sheet_path, quality=88)
        sheets.append({
            "path": str(sheet_path),
            "first": label_for(sheet_index * per_sheet, fps),
            "last": label_for(min(len(frames) - 1, (sheet_index + 1) * per_sheet - 1), fps),
        })
    return sheets


def pick_keyframe_times(cuts: list[float], duration: float, step: float = 10.0) -> list[float]:
    times = {round(cut, 3) for cut in cuts if cut < duration - 0.5}
    t = 0.0
    while t < duration:
        times.add(round(t, 3))
        t += step
    return sorted(times)


def extract_keyframes(path: Path, out: Path, times: list[float]) -> list[Path]:
    out.mkdir(parents=True, exist_ok=True)
    made = []
    for t in times:
        target = out / f"{timestamp_name(t, 1.0)}.jpg"
        if target.exists():
            made.append(target)
            continue
        result = subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
            "-ss", f"{t:.3f}", "-i", str(path), "-frames:v", "1", "-q:v", "2",
            str(target),
        ], capture_output=True, text=True)
        if result.returncode == 0 and target.exists():
            made.append(target)
    return made


def measure_thumbs(frames: list[Path]) -> tuple[np.ndarray, np.ndarray]:
    lumas = []
    motions = []
    previous = None
    for frame_path in frames:
        image = np.asarray(Image.open(frame_path).convert("RGB"), dtype=np.float32) / 255.0
        luma = 0.2126 * image[..., 0] + 0.7152 * image[..., 1] + 0.0722 * image[..., 2]
        lumas.append(float(luma.mean()))
        if previous is None:
            motions.append(0.0)
        else:
            motions.append(float(np.abs(luma - previous).mean()))
        previous = luma
    return np.array(lumas), np.array(motions)


def build_shot_list(cuts: list[float], duration: float, fps: float,
                    lumas: np.ndarray, motions: np.ndarray) -> list[dict]:
    shots = []
    for index, start in enumerate(cuts):
        end = cuts[index + 1] if index + 1 < len(cuts) else duration
        first = int(round(start * fps))
        last = max(first + 1, int(round(end * fps)))
        first = min(first, len(lumas) - 1)
        last = min(last, len(lumas))
        shots.append({
            "index": index + 1,
            "start": round(start, 3),
            "end": round(end, 3),
            "duration": round(end - start, 3),
            "luma": round(float(lumas[first:last].mean()), 4) if last > first else 0.0,
            "motion": round(float(motions[first:last].mean()), 5) if last > first else 0.0,
        })
    return shots


def extract_audio(path: Path, out: Path) -> Path:
    out.mkdir(parents=True, exist_ok=True)
    wav_path = out / "audio.wav"
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(path),
        "-vn", "-ac", "2", "-ar", "44100", "-c:a", "pcm_s16le", str(wav_path),
    ])
    return wav_path


def read_wav(wav_path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(wav_path), "rb") as handle:
        channels = handle.getnchannels()
        rate = handle.getframerate()
        frames = handle.getnframes()
        raw = handle.readframes(frames)
    audio = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if channels > 1:
        audio = audio.reshape(-1, channels).mean(axis=1)
    return audio, rate


def db(value: float) -> float:
    return 20.0 * math.log10(max(value, 1e-9))


def analyse_audio(wav_path: Path, out: Path, duration: float) -> dict:
    audio, rate = read_wav(wav_path)
    window = int(0.5 * rate)
    rows = []
    peak_all = 0.0
    for start in range(0, len(audio), window):
        chunk = audio[start:start + window]
        if chunk.size == 0:
            continue
        rms = float(np.sqrt(np.mean(chunk ** 2)))
        peak = float(np.max(np.abs(chunk)))
        peak_all = max(peak_all, peak)
        rows.append({
            "time": round(start / rate, 2),
            "rms_db": round(db(rms), 2),
            "peak_db": round(db(peak), 2),
        })
    with open(out / "loudness.csv", "w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["time", "rms_db", "peak_db"])
        writer.writeheader()
        writer.writerows(rows)

    # Spectrogram (mono, 1024-window, log-frequency axis) of the whole take.
    import numpy.fft as fft
    n_fft = 2048
    hop = 1024
    frames = []
    window_fn = np.hanning(n_fft)
    max_seconds = min(duration, 900)
    segment = audio[: int(max_seconds * rate)]
    for offset in range(0, max(1, len(segment) - n_fft), hop):
        chunk = segment[offset:offset + n_fft] * window_fn
        frames.append(np.abs(fft.rfft(chunk))[: n_fft // 2])
    if frames:
        spectrogram = np.array(frames).T
        spectrogram_db = 20.0 * np.log10(np.maximum(spectrogram, 1e-6))
        lower, upper = -90.0, -10.0
        normalized = np.clip((spectrogram_db - lower) / (upper - lower), 0, 1)
        # log-frequency rows: 40 Hz .. 16 kHz
        freqs = np.linspace(40.0, 16000.0, 512)
        bin_hz = rate / n_fft
        rows_index = np.clip((freqs / bin_hz).astype(int), 0, spectrogram_db.shape[0] - 1)
        image_array = (normalized[rows_index][::-1] * 255).astype(np.uint8)
        image = Image.fromarray(image_array, mode="L").resize(
            (min(1400, image_array.shape[1] * 2), 420), Image.BILINEAR
        )
        canvas = Image.new("RGB", (image.width, image.height + 24), (14, 16, 19))
        canvas.paste(image.convert("RGB"), (0, 24))
        draw = ImageDraw.Draw(canvas)
        draw.text((6, 4), "spectrogram 40 Hz..16 kHz, whole reference take", font=font(12),
                  fill=(230, 230, 225))
        for minute in range(0, int(max_seconds // 60) + 1):
            x = int(minute * 60 / max_seconds * image.width)
            draw.line([(x, 24), (x, canvas.height)], fill=(70, 80, 90), width=1)
            draw.text((x + 3, 24), f"{minute}m", font=font(10), fill=(200, 200, 195))
        canvas.save(out / "spectrogram.png", quality=92)

    # Band profile over the whole take, plus speech-vs-bed heuristic.
    band_edges = [(20, 120), (120, 300), (300, 800), (800, 2000), (2000, 4000),
                  (4000, 8000), (8000, 16000)]
    mono = audio[: int(duration * rate)]
    n_fft = 2048
    window_fn = np.hanning(n_fft)
    total = np.zeros(n_fft // 2 + 1)
    speech_like = 0
    windows = 0
    for offset in range(0, max(1, len(mono) - n_fft), n_fft):
        chunk = mono[offset:offset + n_fft] * window_fn
        spectrum = np.abs(np.fft.rfft(chunk)) ** 2
        total += spectrum
        flatness = math.exp(np.mean(np.log(np.maximum(spectrum, 1e-12)))) / \
            max(np.mean(spectrum), 1e-12)
        windows += 1
        if 0.0001 < flatness < 0.02:
            speech_like += 1
    power = total / max(1, windows)
    bin_hz = rate / n_fft
    bands = {}
    for low, high in band_edges:
        lo = int(low / bin_hz)
        hi = int(min(high / bin_hz, len(power) - 1))
        bands[f"{low}-{high}"] = float(power[lo:hi].sum())
    band_total = max(sum(bands.values()), 1e-12)
    profile = {
        "duration": round(duration, 2),
        "peak_dbfs": round(db(peak_all), 2),
        "bands_share": {key: round(value / band_total, 4) for key, value in bands.items()},
        "speech_like_fraction": round(speech_like / max(1, windows), 3),
        "rms_median_db": round(float(np.median([row["rms_db"] for row in rows])), 2),
        "rms_low_db": round(float(np.percentile([row["rms_db"] for row in rows], 5)), 2),
        "rms_high_db": round(float(np.percentile([row["rms_db"] for row in rows], 95)), 2),
    }
    (out / "profile.json").write_text(json.dumps(profile, indent=2))
    return profile


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--fps", type=float, default=1.0)
    parser.add_argument("--thumb", type=int, default=320)
    parser.add_argument("--scene", type=float, default=0.3)
    parser.add_argument("--cols", type=int, default=6)
    parser.add_argument("--rows", type=int, default=6)
    parser.add_argument("--step", type=float, default=10.0, help="keyframe spacing, s")
    parser.add_argument("--reuse", action="store_true", help="keep existing frames")
    args = parser.parse_args()

    video = Path(args.video).expanduser().resolve()
    root = Path(args.out).expanduser().resolve()
    if not video.exists():
        print(f"missing video: {video}", file=sys.stderr)
        return 1
    root.mkdir(parents=True, exist_ok=True)

    meta = ffprobe(video)
    (root / "metadata.json").write_text(json.dumps(meta, indent=2))
    duration = meta["duration"]
    print(f"[kit] {video.name}: {duration:.1f}s, {meta['streams'][0].get('width')}x"
          f"{meta['streams'][0].get('height')} @ {meta['streams'][0].get('r_frame_rate')} fps")

    frames_dir = root / "frames"
    frames = sorted(frames_dir.glob("t*.jpg"))
    if not frames or not args.reuse:
        shutil.rmtree(frames_dir, ignore_errors=True)
        frames = extract_thumbs(video, frames_dir, args.fps, args.thumb, duration)
    print(f"[kit] {len(frames)} thumbnails @ {args.fps} fps")

    cuts = scene_cuts(video, args.scene)
    (root / "cuts.json").write_text(json.dumps(cuts, indent=2))
    print(f"[kit] {len(cuts)} scene cuts at threshold {args.scene}")

    lumas, motions = measure_thumbs(frames)
    shots = build_shot_list(cuts, duration, args.fps, lumas, motions)
    with open(root / "shots.csv", "w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["index", "start", "end", "duration", "luma", "motion"])
        writer.writeheader()
        writer.writerows(shots)
    print(f"[kit] {len(shots)} shots -> shots.csv")

    sheets = make_sheets(frames, root / "sheets", args.fps, args.cols, args.rows, args.thumb)
    print(f"[kit] {len(sheets)} contact sheets")

    keyframe_times = pick_keyframe_times(cuts, duration, args.step)
    keyframes = extract_keyframes(video, root / "keyframes", keyframe_times)
    print(f"[kit] {len(keyframes)} keyframes")

    index = []
    for frame_path in frames:
        number = int(re.search(r"t(\d+)", frame_path.name).group(1)) - 1
        seconds = round(number / args.fps, 2)
        shot = next((s for s in shots if s["start"] <= seconds < s["end"]), None)
        index.append({
            "time": seconds,
            "label": label_for(number, args.fps),
            "frame": str(frame_path),
            "shot": shot["index"] if shot else None,
        })
    (root / "frames.json").write_text(json.dumps(
        {"fps": args.fps, "frames": index, "sheets": sheets}, indent=2))

    wav_path = extract_audio(video, root / "audio")
    profile = analyse_audio(wav_path, root / "audio", duration)
    print(f"[kit] audio profile: peak {profile['peak_dbfs']} dBFS, "
          f"speech-like {profile['speech_like_fraction']}, "
          f"bands {profile['bands_share']}")

    print(f"[kit] done -> {root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

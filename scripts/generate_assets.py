#!/usr/bin/env python3
"""Generate placeholder WAV narration files and PWA PNG icons."""

from __future__ import annotations

import math
import struct
import wave
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "assets" / "audio"
ICONS = ROOT / "assets" / "icons"

TONES = {
    "shanmen.wav": 220.0,
    "hubian.wav": 246.94,
    "miaoyu.wav": 196.0,
    "gucheng.wav": 174.61,
    "shanlu.wav": 261.63,
}


def write_wav(path: Path, freq: float, duration: float = 2.6, rate: int = 22050) -> None:
    n = int(duration * rate)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(rate)
        frames = bytearray()
        for i in range(n):
            t = i / rate
            fade_in = min(1.0, t / 0.08)
            fade_out = min(1.0, (duration - t) / 0.25)
            env = fade_in * fade_out
            sample = 0.32 * math.sin(2 * math.pi * freq * t)
            sample += 0.12 * math.sin(2 * math.pi * freq * 2 * t)
            value = int(max(-1.0, min(1.0, sample * env)) * 32767)
            frames += struct.pack("<h", value)
        wf.writeframes(frames)


def png_chunk(tag: bytes, data: bytes) -> bytes:
    crc = zlib.crc32(tag + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)


def write_png(path: Path, size: int, maskable: bool) -> None:
    pad = int(size * 0.12) if maskable else 0
    ink = (18, 16, 12)
    gold = (201, 164, 92)
    gold_bright = (232, 201, 122)
    bronze = (138, 106, 59)

    rows = []
    cx = cy = size / 2
    outer = size * (0.36 if maskable else 0.42)
    inner = outer * 0.62
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            dx = x + 0.5 - cx
            dy = y + 0.5 - cy
            r = math.hypot(dx, dy)
            in_safe = pad <= x < size - pad and pad <= y < size - pad
            if r <= outer + 1.6 and r >= outer - 3.2:
                color = gold_bright if abs(r - outer) < 1.2 else gold
            elif r <= inner:
                color = gold
            elif r <= outer:
                # dark disc with a faint bronze wash
                t = (r / outer)
                color = (
                    int(ink[0] + bronze[0] * 0.12 * t),
                    int(ink[1] + bronze[1] * 0.1 * t),
                    int(ink[2] + bronze[2] * 0.08 * t),
                )
            else:
                color = ink if (maskable or in_safe or r < size * 0.48) else ink
            # simple 泽-like vertical mark
            if abs(dx) < size * 0.035 and -outer * 0.55 < dy < outer * 0.5:
                color = gold_bright
            if abs(dy + outer * 0.08) < size * 0.028 and abs(dx) < outer * 0.42:
                color = gold
            row += bytes(color + (255,))
        rows.append(bytes(row))

    raw = b"".join(rows)
    compressed = zlib.compress(raw, 9)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", ihdr) + png_chunk(b"IDAT", compressed) + png_chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def main() -> None:
    for name, freq in TONES.items():
        write_wav(AUDIO / name, freq)
    write_png(ICONS / "icon-192.png", 192, False)
    write_png(ICONS / "icon-512.png", 512, False)
    write_png(ICONS / "icon-192-maskable.png", 192, True)
    write_png(ICONS / "icon-512-maskable.png", 512, True)
    write_png(ICONS / "apple-touch-icon.png", 180, False)
    print("assets written")


if __name__ == "__main__":
    main()

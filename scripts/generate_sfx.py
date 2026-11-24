#!/usr/bin/env python3
"""
Yumuşak, kulağı tırmalamayan kısa sentetik geçiş sesleri üretir:
- public/sfx/whoosh.wav (0.30 sn — yumuşak filtrelenmiş hava geçişi)
- public/sfx/pop.wav    (0.11 sn — sıcak, tıklamasız UI odak sesi)
- public/sfx/tick.wav   (0.055 sn — kod satırı / adım geçişi için ince mekanik dokunuş)

Harici kütüphane gerektirmez; yalnızca Python standart kütüphanesini kullanır.
"""

from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 44100
ROOT_DIR = Path(__file__).resolve().parent.parent
SFX_DIR = ROOT_DIR / "public" / "sfx"


def write_mono_wav(path: Path, samples: list[float], peak_level: float = 0.32) -> None:
    """Örnekleri güvenli tepe seviyesine normalize ederek 16-bit mono WAV yazar."""
    path.parent.mkdir(parents=True, exist_ok=True)
    max_val = max((abs(s) for s in samples), default=1.0) or 1.0
    scale = peak_level / max_val

    pcm = bytearray()
    for s in samples:
        clamped = max(-1.0, min(1.0, s * scale))
        pcm.extend(struct.pack("<h", int(clamped * 32767)))

    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(bytes(pcm))


def generate_soft_whoosh(duration_sec: float = 0.30) -> list[float]:
    """Sert tıslama içermeyen, çift aşamalı alçak geçiren filtreli hava geçiş efekti."""
    rng = random.Random(42)
    total = int(SAMPLE_RATE * duration_sec)
    out: list[float] = []

    lp1 = 0.0
    lp2 = 0.0
    brown = 0.0
    phase = 0.0

    for i in range(total):
        u = i / max(1, total - 1)
        env = (math.sin(math.pi * (u ** 0.78))) ** 1.7

        white = rng.uniform(-1.0, 1.0)
        brown = 0.86 * brown + 0.14 * white
        soft_noise = 0.65 * brown + 0.35 * white

        cutoff_hz = 180.0 + 640.0 * (math.sin(math.pi * u) ** 1.4)
        alpha = min(
            0.95,
            (2.0 * math.pi * cutoff_hz) / (SAMPLE_RATE + 2.0 * math.pi * cutoff_hz),
        )
        lp1 += alpha * (soft_noise - lp1)
        lp2 += alpha * (lp1 - lp2)

        sub_freq = 108.0 + 48.0 * math.sin(math.pi * u)
        phase += 2.0 * math.pi * sub_freq / SAMPLE_RATE
        sub_body = 0.16 * math.sin(phase)

        edge_fade = 1.0
        fade_samples = int(0.008 * SAMPLE_RATE)
        if i < fade_samples:
            edge_fade = 0.5 * (1.0 - math.cos(math.pi * i / fade_samples))
        elif i > total - fade_samples:
            rem = total - 1 - i
            edge_fade = 0.5 * (1.0 - math.cos(math.pi * rem / fade_samples))

        out.append((lp2 * 1.4 + sub_body) * env * edge_fade)

    return out


def generate_soft_pop(duration_sec: float = 0.11) -> list[float]:
    """Sıcak, yuvarlak ve tıklamasız arayüz odak sesi (pop)."""
    total = int(SAMPLE_RATE * duration_sec)
    out: list[float] = []
    phase1 = 0.0
    phase2 = 0.0

    attack_sec = 0.004
    fade_out_sec = 0.015

    for i in range(total):
        t = i / SAMPLE_RATE
        freq = 195.0 + 245.0 * math.exp(-t / 0.020)
        phase1 += 2.0 * math.pi * freq / SAMPLE_RATE
        phase2 += 2.0 * math.pi * (freq * 2.0) / SAMPLE_RATE

        attack = 0.5 * (1.0 - math.cos(math.pi * min(1.0, t / attack_sec)))
        decay = math.exp(-t / 0.024)
        harmonic_decay = math.exp(-t / 0.011)

        tail_fade = 1.0
        rem_sec = duration_sec - t
        if rem_sec < fade_out_sec:
            tail_fade = 0.5 * (1.0 - math.cos(math.pi * max(0.0, rem_sec) / fade_out_sec))

        sample = (
            math.sin(phase1) + 0.09 * math.sin(phase2) * harmonic_decay
        ) * attack * decay * tail_fade
        out.append(sample)

    return out


def generate_soft_tick(duration_sec: float = 0.055) -> list[float]:
    """
    Kod satırı ve adım geçişleri için çok kısa, kulağı yormayan yumuşak mekanik tick.
    Tiz cam tıklaması yerine sıcak ahşap/saat benzeri yumuşak transient üretir.
    """
    total = int(SAMPLE_RATE * duration_sec)
    out: list[float] = []
    phase_hi = 0.0
    phase_body = 0.0

    attack_sec = 0.0018
    fade_out_sec = 0.008

    for i in range(total):
        t = i / SAMPLE_RATE

        # Hızla sönümlenen yumuşak tık + düşük gövde tınısı
        freq_hi = 880.0 + 420.0 * math.exp(-t / 0.006)
        freq_body = 320.0 + 110.0 * math.exp(-t / 0.009)
        phase_hi += 2.0 * math.pi * freq_hi / SAMPLE_RATE
        phase_body += 2.0 * math.pi * freq_body / SAMPLE_RATE

        attack = 0.5 * (1.0 - math.cos(math.pi * min(1.0, t / attack_sec)))
        decay_hi = math.exp(-t / 0.0075)
        decay_body = math.exp(-t / 0.014)

        tail_fade = 1.0
        rem_sec = duration_sec - t
        if rem_sec < fade_out_sec:
            tail_fade = 0.5 * (1.0 - math.cos(math.pi * max(0.0, rem_sec) / fade_out_sec))

        sample = (
            0.62 * math.sin(phase_hi) * decay_hi
            + 0.45 * math.sin(phase_body) * decay_body
        ) * attack * tail_fade
        out.append(sample)

    return out


def generate_soft_thud(duration_sec: float = 0.24) -> list[float]:
    """
    MetricBanner ve büyük bölüm açılışları için kulağı yormayan, sıcak ve derin
    alt-bas sinematik vuruş (78 Hz -> 42 Hz sönümlü sub-thump).
    """
    total = int(SAMPLE_RATE * duration_sec)
    out: list[float] = []
    phase_sub = 0.0
    phase_warm = 0.0

    attack_sec = 0.008
    fade_out_sec = 0.030

    for i in range(total):
        t = i / SAMPLE_RATE

        freq_sub = 42.0 + 44.0 * math.exp(-t / 0.045)
        freq_warm = freq_sub * 2.0
        phase_sub += 2.0 * math.pi * freq_sub / SAMPLE_RATE
        phase_warm += 2.0 * math.pi * freq_warm / SAMPLE_RATE

        attack = 0.5 * (1.0 - math.cos(math.pi * min(1.0, t / attack_sec)))
        decay_sub = math.exp(-t / 0.068)
        decay_warm = math.exp(-t / 0.025)

        tail_fade = 1.0
        rem_sec = duration_sec - t
        if rem_sec < fade_out_sec:
            tail_fade = 0.5 * (1.0 - math.cos(math.pi * max(0.0, rem_sec) / fade_out_sec))

        sample = (
            0.85 * math.sin(phase_sub) * decay_sub
            + 0.18 * math.sin(phase_warm) * decay_warm
        ) * attack * tail_fade
        out.append(sample)

    return out


def main() -> None:
    whoosh_path = SFX_DIR / "whoosh.wav"
    pop_path = SFX_DIR / "pop.wav"
    tick_path = SFX_DIR / "tick.wav"
    thud_path = SFX_DIR / "thud.wav"

    write_mono_wav(whoosh_path, generate_soft_whoosh(), peak_level=0.30)
    write_mono_wav(pop_path, generate_soft_pop(), peak_level=0.32)
    write_mono_wav(tick_path, generate_soft_tick(), peak_level=0.28)
    write_mono_wav(thud_path, generate_soft_thud(), peak_level=0.34)

    for p in (whoosh_path, pop_path, tick_path, thud_path):
        print(f"[sfx] Üretildi: {p} ({p.stat().st_size} byte)")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Hafif, karanlık ve düşük frekanslı, dikişsiz döngülenebilir (seamless loop)
synth/ambient pad arka plan müziği üretir -> public/audio/ambient.mp3

Konuşma frekanslarını (300 Hz - 4 kHz) bastırmayacak şekilde sıcak bas/pad
spektrumu üzerine tasarlanmıştır.
"""

from __future__ import annotations

import math
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT_DIR = Path(__file__).resolve().parent.parent
OUTPUT_MP3 = ROOT_DIR / "public" / "audio" / "ambient.mp3"
SAMPLE_RATE = 44100
DURATION_SEC = 24.0


def synthesize_dark_ambient_stereo(duration_sec: float = DURATION_SEC) -> tuple[np.ndarray, np.ndarray]:
    """
    24 saniyelik kusursuz döngü (tüm osilatörler ve LFO'lar tam periyotla kapanır):
    D minor 9 karanlık ambient akor (D2, A2, E3, F3) + hafif stereo detune + nefes alan LFO.
    """
    n = int(SAMPLE_RATE * duration_sec)
    t = np.arange(n, dtype=np.float64) / SAMPLE_RATE

    def loop_freq(target_hz: float) -> float:
        """Verilen frekansı tam döngü sayısına yuvarlar — loop dikişini tamamen sıfırlar."""
        cycles = max(1, round(target_hz * duration_sec))
        return cycles / duration_sec

    # Temel karanlık pad notaları (konuşma bandının altında/etrafında yumuşak frekanslar)
    voices = [
        # (sol frekans, sağ frekans, genlik, LFO döngü sayısı, faz)
        (73.42, 73.50, 0.42, 1, 0.0),    # D2 derin sub-pad
        (110.00, 110.12, 0.30, 2, 1.1),  # A2 sıcak beşli
        (146.83, 146.70, 0.20, 1, 2.3),  # D3 oktav gövde
        (164.81, 164.95, 0.14, 3, 0.7),  # E3 (minor 9 renk)
        (174.61, 174.48, 0.11, 2, 3.8),  # F3 (minor 3 derinlik)
        (220.00, 220.20, 0.08, 3, 2.0),  # A3 çok yumuşak üst katman
    ]

    left = np.zeros(n, dtype=np.float64)
    right = np.zeros(n, dtype=np.float64)

    for f_l, f_r, amp, lfo_cycles, ph in voices:
        fl = loop_freq(f_l)
        fr = loop_freq(f_r)

        # Yavaş nefes alan genlik modülasyonu (tam tam-sayı periyotlu)
        lfo_l = 0.72 + 0.28 * np.sin(2.0 * math.pi * (lfo_cycles / duration_sec) * t + ph)
        lfo_r = 0.72 + 0.28 * np.cos(2.0 * math.pi * (lfo_cycles / duration_sec) * t + ph)

        # Saf sinüs + çok hafif yumuşak 2. harmonik (analog sıcaklık)
        sig_l = np.sin(2.0 * math.pi * fl * t) + 0.14 * np.sin(2.0 * math.pi * (2.0 * fl) * t + 0.4)
        sig_r = np.sin(2.0 * math.pi * fr * t + 0.2) + 0.14 * np.sin(2.0 * math.pi * (2.0 * fr) * t + 1.0)

        left += amp * lfo_l * sig_l
        right += amp * lfo_r * sig_r

    # Çok hafif genel atmosferik nefes zarfı (24sn boyunca 2 yumuşak dalga)
    master_lfo = 0.85 + 0.15 * np.sin(2.0 * math.pi * (2.0 / duration_sec) * t)
    left *= master_lfo
    right *= master_lfo

    # Güvenli -18 dBFS civarı tepe normalize (zaten TimelineRenderer 0.06 çarpanıyla çalar)
    peak = max(float(np.max(np.abs(left))), float(np.max(np.abs(right))), 1e-6)
    target_peak = 0.38
    left = (left / peak) * target_peak
    right = (right / peak) * target_peak

    return left.astype(np.float32), right.astype(np.float32)


def main() -> None:
    OUTPUT_MP3.parent.mkdir(parents=True, exist_ok=True)
    left, right = synthesize_dark_ambient_stereo()

    interleaved = np.empty(left.size * 2, dtype=np.int16)
    interleaved[0::2] = np.clip(left * 32767.0, -32767, 32767).astype(np.int16)
    interleaved[1::2] = np.clip(right * 32767.0, -32767, 32767).astype(np.int16)

    with tempfile.TemporaryDirectory() as tmpdir:
        wav_path = Path(tmpdir) / "ambient.wav"
        with wave.open(str(wav_path), "wb") as wf:
            wf.setnchannels(2)
            wf.setsampwidth(2)
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(interleaved.tobytes())

        # Düşük geçiren filtreyle 550 Hz üstünü yumuşatıp 192kbps stereo MP3 üret
        subprocess.run(
            [
                "ffmpeg",
                "-hide_banner",
                "-y",
                "-i",
                str(wav_path),
                "-af",
                "lowpass=f=520:poles=2",
                "-c:a",
                "libmp3lame",
                "-b:a",
                "192k",
                str(OUTPUT_MP3),
            ],
            capture_output=True,
            check=True,
        )

    print(f"[ambient] Üretildi: {OUTPUT_MP3} ({OUTPUT_MP3.stat().st_size} byte, {DURATION_SEC:.0f} sn loop)")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Tek komutluk ses temizleme (mastering) ve akıllı duraksama kesme (jump-cut) betiği.

Ne yapar?
1. FFmpeg 2-geçişli yayın mastering zinciri uygular:
   - Alt uğultu filtresi (highpass 85Hz)
   - Uyarlanabilir spektral gürültü azaltma (afftdn)
   - Ses netliği ve boğukluk giderme EQ (sıcaklık + 280Hz çamur kesimi + 3.2kHz berraklık + 6.8kHz hava)
   - Sert "s/ş" yumuşatma (deesser)
   - Ses dengeleyici kompresör + tepe sınırlayıcı (acompressor + alimiter)
   - 2-geçişli EBU R128 YouTube ses yüksekliği normalizasyonu (-14 LUFS, -1.5 dBTP)
2. Akıllı duraksama kesici (Jump-Cut):
   - Konuşma aralarındaki istenmeyen uzun boşlukları ve baş/son sessizliklerini
     ünsüz harfleri kesmeden (ön/arka güvenlik payı + 18ms kosinüs crossfade ile) kısaltır.
3. Temiz sesi `public/audio/kayit_temiz.wav` olarak kaydeder.

Kullanım:
    .venv/bin/python scripts/enhance_audio.py
    .venv/bin/python scripts/enhance_audio.py "public/audio/Yeni Kayıt.m4a"
"""

from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

ROOT_DIR = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT_DIR / "public" / "audio"
DEFAULT_OUTPUT = AUDIO_DIR / "kayit_temiz.wav"
SUPPORTED_EXTS = (".m4a", ".mp3", ".wav")
SAMPLE_RATE = 48000


def find_raw_audio() -> Path | None:
    """`public/audio/` içindeki ham ses kaydını bulur (`*_temiz.*` çıktılarını atlar)."""
    if not AUDIO_DIR.is_dir():
        return None

    for stem in ("kayit",):
        for ext in SUPPORTED_EXTS:
            cand = AUDIO_DIR / f"{stem}{ext}"
            if cand.is_file():
                return cand

    candidates: list[Path] = []
    for ext in SUPPORTED_EXTS:
        for p in sorted(AUDIO_DIR.glob(f"*{ext}")):
            if "_temiz" not in p.stem.lower():
                candidates.append(p)
    return candidates[0] if candidates else None


def build_voice_chain() -> str:
    """Kulağı yormayan, net ve sıcak podcast/YouTube ses mastering zinciri."""
    return ",".join(
        [
            "highpass=f=85:poles=2",
            "afftdn=nr=14:nf=-46:tn=1",
            "equalizer=f=135:t=q:w=1.2:g=1.8",
            "equalizer=f=280:t=q:w=1.4:g=-2.8",
            "equalizer=f=3200:t=q:w=1.3:g=3.2",
            "equalizer=f=6800:t=q:w=1.5:g=1.6",
            "deesser=i=0.35:m=0.5:f=0.5:s=o",
            "acompressor=threshold=-24dB:ratio=3.2:attack=8:release=140:makeup=5",
            "alimiter=limit=0.95:level=disabled",
        ]
    )


def master_audio_ffmpeg(input_path: Path, output_wav: Path, target_lufs: float) -> dict[str, str]:
    """2-geçişli EBU R128 loudnorm ile sesi stüdyo netliğine ve -14 LUFS seviyesine getirir."""
    chain = build_voice_chain()

    # 1. Geçiş: Ses yüksekliği istatistiklerini ölç
    pass1_filter = f"{chain},loudnorm=I={target_lufs}:TP=-1.5:LRA=7:print_format=json"
    p1 = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostdin",
            "-i",
            str(input_path),
            "-af",
            pass1_filter,
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
        check=True,
    )

    json_match = re.findall(r"\{[^{}]*\"input_i\"[^{}]*\}", p1.stderr, re.DOTALL)
    if not json_match:
        raise RuntimeError("FFmpeg loudnorm 1. geçiş istatistiği okunamadı.")

    stats = json.loads(json_match[-1])

    # 2. Geçiş: Ölçülen gerçek değerlerle doğrusal (linear=true) yüksek kaliteli normalizasyon
    loudnorm_p2 = (
        f"loudnorm=I={target_lufs}:TP=-1.5:LRA=7:linear=true:"
        f"measured_I={stats['input_i']}:"
        f"measured_TP={stats['input_tp']}:"
        f"measured_LRA={stats['input_lra']}:"
        f"measured_thresh={stats['input_thresh']}:"
        f"offset={stats['target_offset']}"
    )
    pass2_filter = f"{chain},{loudnorm_p2}"

    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-nostdin",
            "-y",
            "-i",
            str(input_path),
            "-af",
            pass2_filter,
            "-ac",
            "1",
            "-ar",
            str(SAMPLE_RATE),
            "-c:a",
            "pcm_s16le",
            str(output_wav),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return stats


def read_wav_float32(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as wf:
        sr = wf.getframerate()
        n_frames = wf.getnframes()
        raw = wf.readframes(n_frames)
    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    return samples, sr


def write_wav_float32(path: Path, samples: np.ndarray, sr: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    clipped = np.clip(samples, -0.99, 0.99)
    pcm = (clipped * 32767.0).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())


def crossfade_append(acc: np.ndarray, chunk: np.ndarray, xfade_samples: int) -> np.ndarray:
    """İki ses parçasını çıtlama olmadan yumuşak kosinüs crossfade ile birleştirir."""
    if acc.size == 0:
        return chunk.copy()
    n = min(xfade_samples, acc.size // 2, chunk.size // 2)
    if n <= 1:
        return np.concatenate([acc, chunk])

    t = np.linspace(0.0, math.pi, n, dtype=np.float32)
    fade_out = 0.5 * (1.0 + np.cos(t))
    fade_in = 0.5 * (1.0 - np.cos(t))

    blended = acc[-n:] * fade_out + chunk[:n] * fade_in
    return np.concatenate([acc[:-n], blended, chunk[n:]])


def trim_pauses_smart(
    samples: np.ndarray,
    sr: int,
    threshold_db: float = -27.5,
    min_pause_sec: float = 0.28,
    short_pause_keep: float = 0.14,
    long_pause_keep: float = 0.22,
    lead_in_sec: float = 0.10,
    tail_out_sec: float = 0.32,
) -> tuple[np.ndarray, list[dict[str, float]]]:
    """
    Akıllı Jump-Cut sessizlik kısaltıcı:
    - Konuşma baş/bitiş ünsüzlerini korumak için ön/arka güvenlik payı bırakır.
    - Orta duraksamaları (`min_pause_sec..0.65sn`) `short_pause_keep` süresine,
      uzun cümle arası duraksamaları (`>0.65sn`) `long_pause_keep` süresine indirir.
    - Tüm birleştirmelerde 18ms kosinüs crossfade uygular.
    """
    frame_ms = 10
    hop = int(sr * frame_ms / 1000)
    n_frames = len(samples) // hop
    if n_frames == 0:
        return samples, []

    framed = samples[: n_frames * hop].reshape(n_frames, hop)
    rms = np.sqrt(np.mean(framed * framed, axis=1) + 1e-12)
    db = 20.0 * np.log10(rms)

    is_speech = db > threshold_db

    # Konuşma adacıklarını tespit et
    raw_islands: list[tuple[int, int]] = []
    in_seg = False
    seg_start = 0
    for idx, active in enumerate(is_speech):
        if active and not in_seg:
            seg_start = idx
            in_seg = True
        elif not active and in_seg:
            raw_islands.append((seg_start, idx))
            in_seg = False
    if in_seg:
        raw_islands.append((seg_start, n_frames))

    if not raw_islands:
        return samples, []

    # 30ms'den kısa anlık mikro gürültü kıpırtılarını (nefes/ağız çıtlaması) yok say
    islands = [seg for seg in raw_islands if (seg[1] - seg[0]) * frame_ms >= 40]
    if not islands:
        return samples, []

    # `min_pause_sec` altındaki doğal kelime içi boşlukları birleştir
    min_gap_frames = int(min_pause_sec * 1000 / frame_ms)
    merged: list[list[int]] = [[islands[0][0], islands[0][1]]]
    for start, end in islands[1:]:
        if start - merged[-1][1] < min_gap_frames:
            merged[-1][1] = end
        else:
            merged.append([start, end])

    # Örnek indekslerine çevir + ünsüz koruma payı ekle
    pre_pad = int(0.065 * sr)
    post_pad = int(0.095 * sr)
    xfade = int(0.018 * sr)
    total_len = len(samples)

    trimmed_cuts: list[dict[str, float]] = []
    output = np.array([], dtype=np.float32)

    # Başlangıç boşluğu raporu
    first_speech_sec = merged[0][0] * frame_ms / 1000.0
    if first_speech_sec > lead_in_sec + 0.05:
        trimmed_cuts.append(
            {
                "fromSec": 0.0,
                "toSec": round(first_speech_sec, 3),
                "origDur": round(first_speech_sec, 3),
                "keptDur": round(lead_in_sec, 3),
            }
        )

    lead_samples = int(lead_in_sec * sr)
    first_start = max(0, merged[0][0] * hop - lead_samples)

    for i, (f_start, f_end) in enumerate(merged):
        s_start = first_start if i == 0 else max(0, f_start * hop - pre_pad)
        s_end = min(total_len, f_end * hop + post_pad)

        # Sonraki parçayla çakışma varsa ortadan böl
        if i + 1 < len(merged):
            next_start_raw = merged[i + 1][0] * hop
            gap_sec = (merged[i + 1][0] - f_end) * frame_ms / 1000.0
            keep_sec = long_pause_keep if gap_sec >= 0.65 else short_pause_keep

            if gap_sec > keep_sec + 0.03:
                # Doğal nefes payının yarısını bu parçanın sonundan, yarısını sonrakinin başından koru
                keep_samples = int(keep_sec * sr)
                s_end = min(total_len, f_end * hop + max(post_pad, keep_samples // 2))
                trimmed_cuts.append(
                    {
                        "fromSec": round(f_end * frame_ms / 1000.0, 3),
                        "toSec": round(merged[i + 1][0] * frame_ms / 1000.0, 3),
                        "origDur": round(gap_sec, 3),
                        "keptDur": round(keep_sec, 3),
                    }
                )
            else:
                s_end = min(total_len, next_start_raw)

        chunk = samples[s_start:s_end]
        output = crossfade_append(output, chunk, xfade)

    # Bitiş kuyruğu: doğal kapanış payı + yumuşak fade-out
    last_end_sec = merged[-1][1] * frame_ms / 1000.0
    orig_tail_sec = (total_len / sr) - last_end_sec
    if orig_tail_sec > tail_out_sec + 0.05:
        trimmed_cuts.append(
            {
                "fromSec": round(last_end_sec, 3),
                "toSec": round(total_len / sr, 3),
                "origDur": round(orig_tail_sec, 3),
                "keptDur": round(tail_out_sec, 3),
            }
        )

    tail_samples = int(max(0.0, tail_out_sec - 0.095) * sr)
    if tail_samples > 0:
        # Gerçek kayıt kuyruğundan temiz oda sessizliği al ve yumuşakça sıfıra indir
        tail_src_start = min(total_len, merged[-1][1] * hop + post_pad)
        tail_src_end = min(total_len, tail_src_start + tail_samples)
        tail = samples[tail_src_start:tail_src_end].copy()
        if tail.size < tail_samples:
            tail = np.pad(tail, (0, tail_samples - tail.size))
        fade = 0.5 * (1.0 + np.cos(np.linspace(0.0, math.pi, tail.size, dtype=np.float32)))
        output = crossfade_append(output, tail * fade, xfade)

    # Başta ve sonda 12ms tıklama önleyici zarf
    edge = min(int(0.012 * sr), output.size // 4)
    if edge > 1:
        ramp_in = 0.5 * (1.0 - np.cos(np.linspace(0.0, math.pi, edge, dtype=np.float32)))
        ramp_out = 0.5 * (1.0 + np.cos(np.linspace(0.0, math.pi, edge, dtype=np.float32)))
        output[:edge] *= ramp_in
        output[-edge:] *= ramp_out

    return output, trimmed_cuts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Mikrofon kaydını stüdyo netliğine getirir ve uzun duraksamaları keser."
    )
    parser.add_argument(
        "audio",
        nargs="?",
        default=None,
        help="Ham ses dosyası yolu (varsayılan: public/audio/ içindeki ham kayıt)",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help="Temizlenmiş çıktı WAV yolu (varsayılan: public/audio/kayit_temiz.wav)",
    )
    parser.add_argument(
        "--lufs",
        type=float,
        default=-14.0,
        help="Hedef YouTube/podcast ses yüksekliği (varsayılan: -14.0 LUFS)",
    )
    parser.add_argument(
        "--threshold-db",
        type=float,
        default=-27.5,
        help="Sessizlik algılama eşiği dBFS (varsayılan: -27.5)",
    )
    parser.add_argument(
        "--no-trim",
        action="store_true",
        help="Yalnızca ses netleştirme/mastering yap, duraksamaları kesme",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_path = Path(args.audio).resolve() if args.audio else find_raw_audio()

    if input_path is None or not input_path.is_file():
        print(
            "[HATA] İşlenecek ham ses dosyası bulunamadı.\n"
            f"Lütfen kaydınızı `{AUDIO_DIR}/` klasörüne koyun veya yol verin.",
            file=sys.stderr,
        )
        return 1

    output_path = Path(args.output).resolve()

    print(f"[enhance] Ham kayıt: {input_path.name}")
    print(f"[enhance] 1/2 Stüdyo mastering uygulanıyor (EQ + Denoise + De-ess + {args.lufs} LUFS)...")

    with tempfile.TemporaryDirectory() as tmpdir:
        mastered_wav = Path(tmpdir) / "mastered.wav"
        stats = master_audio_ffmpeg(input_path, mastered_wav, target_lufs=args.lufs)

        samples, sr = read_wav_float32(mastered_wav)
        orig_dur = len(samples) / sr

        if args.no_trim:
            final_samples = samples
            cuts: list[dict[str, float]] = []
        else:
            print(f"[enhance] 2/2 Akıllı duraksama kesimi (Jump-Cut, eşik: {args.threshold_db} dB)...")
            final_samples, cuts = trim_pauses_smart(
                samples,
                sr,
                threshold_db=args.threshold_db,
            )

        write_wav_float32(output_path, final_samples, sr)

    new_dur = len(final_samples) / sr
    saved = orig_dur - new_dur

    print(f"[enhance] Giriş ortalama ses seviyesi : {stats['input_i']} LUFS -> Hedef: {args.lufs} LUFS")
    print(f"[enhance] Süre değişimi              : {orig_dur:.2f} sn -> {new_dur:.2f} sn (-{saved:.2f} sn boşluk kesildi)")
    print(f"[enhance] Kısaltılan duraksama sayısı: {len(cuts)}")
    for c in cuts:
        print(
            f"          - {c['fromSec']:5.2f}s–{c['toSec']:5.2f}s "
            f"({c['origDur']:.2f}sn -> {c['keptDur']:.2f}sn)"
        )
    print(f"[enhance] Çıktı hazır: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

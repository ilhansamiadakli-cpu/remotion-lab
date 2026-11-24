#!/usr/bin/env python3
"""
Tek komutluk Türkçe ses çözümleyici (faster-whisper).

Kullanım:
    python3 scripts/transcribe.py
    python3 scripts/transcribe.py public/audio/kayit.wav --model medium

Varsayılan olarak `public/audio/kayit.{mp3,wav,m4a}` dosyasını bulur ve
kelime/cümle bazlı zaman damgalarıyla `src/data/transcript.json` dosyasını üretir.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT_DIR / "public" / "audio"
DEFAULT_OUTPUT = ROOT_DIR / "src" / "data" / "transcript.json"
SUPPORTED_EXTS = (".mp3", ".wav", ".m4a")


def find_default_audio() -> Path | None:
    """Önce temizlenmiş `kayit_temiz.*`, sonra `kayit.*`, yoksa ilk desteklenen sesi bulur."""
    for stem in ("kayit_temiz", "kayit"):
        for ext in (".wav", ".mp3", ".m4a"):
            candidate = AUDIO_DIR / f"{stem}{ext}"
            if candidate.is_file():
                return candidate

    if AUDIO_DIR.is_dir():
        for ext in SUPPORTED_EXTS:
            matches = sorted(AUDIO_DIR.glob(f"*{ext}"))
            if matches:
                return matches[0]
    return None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="public/audio/ içindeki Türkçe ses kaydını src/data/transcript.json olarak çıkarır."
    )
    parser.add_argument(
        "audio",
        nargs="?",
        default=None,
        help="Ses dosyası yolu (varsayılan: public/audio/kayit.mp3|.wav|.m4a)",
    )
    parser.add_argument(
        "--model",
        default="small",
        help="faster-whisper model boyutu (tiny, base, small, medium, large-v3)",
    )
    parser.add_argument(
        "--device",
        default="auto",
        help="Çalıştırma cihazı (auto, cpu, cuda)",
    )
    parser.add_argument(
        "--compute-type",
        default="int8",
        help="Hesaplama hassasiyeti (int8, float16, float32)",
    )
    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
        help="Çıktı JSON dosya yolu (varsayılan: src/data/transcript.json)",
    )
    return parser.parse_args()


def decode_audio_ffmpeg(audio_path: Path, sample_rate: int = 16000):
    """PyAV 19+ uyumsuzluğu durumunda sesi ffmpeg ile 16kHz mono float32 diziye çözer."""
    import numpy as np

    cmd = [
        "ffmpeg",
        "-nostdin",
        "-threads",
        "0",
        "-i",
        str(audio_path),
        "-f",
        "f32le",
        "-ac",
        "1",
        "-acodec",
        "pcm_f32le",
        "-ar",
        str(sample_rate),
        "-",
    ]
    proc = subprocess.run(cmd, capture_output=True, check=True)
    return np.frombuffer(proc.stdout, dtype=np.float32)


def main() -> int:
    args = parse_args()

    audio_path = Path(args.audio).resolve() if args.audio else find_default_audio()
    if audio_path is None or not audio_path.is_file():
        print(
            "[HATA] Ses dosyası bulunamadı.\n"
            f"Lütfen kaydınızı `{AUDIO_DIR}/kayit.mp3` (.wav veya .m4a) olarak yerleştirin "
            "ya da dosya yolunu parametre olarak verin:\n"
            "  python3 scripts/transcribe.py public/audio/kayit.mp3",
            file=sys.stderr,
        )
        return 1

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(
            "[HATA] `faster-whisper` paketi kurulu değil.\n"
            "Kurmak için şu komutu çalıştırın:\n"
            "  pip install faster-whisper",
            file=sys.stderr,
        )
        return 1

    print(f"[transcribe] Model yükleniyor: {args.model} ({args.device} / {args.compute_type})")
    model = WhisperModel(
        args.model,
        device=args.device,
        compute_type=args.compute_type,
    )

    print(f"[transcribe] Çözümleniyor (language='tr'): {audio_path}")
    try:
        raw_segments, info = model.transcribe(
            str(audio_path),
            language="tr",
            word_timestamps=True,
            vad_filter=True,
        )
    except TypeError:
        audio_input = decode_audio_ffmpeg(audio_path)
        raw_segments, info = model.transcribe(
            audio_input,
            language="tr",
            word_timestamps=True,
            vad_filter=True,
        )

    segments_out = []
    full_text_parts = []

    for idx, seg in enumerate(raw_segments):
        text = seg.text.strip()
        if not text:
            continue
        full_text_parts.append(text)

        words_out = []
        if seg.words:
            for w in seg.words:
                words_out.append(
                    {
                        "word": w.word.strip(),
                        "startSec": round(float(w.start), 3),
                        "endSec": round(float(w.end), 3),
                        "probability": round(float(w.probability), 4),
                    }
                )

        segments_out.append(
            {
                "id": idx,
                "startSec": round(float(seg.start), 3),
                "endSec": round(float(seg.end), 3),
                "text": text,
                "words": words_out,
            }
        )

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        relative_source = str(audio_path.relative_to(ROOT_DIR))
    except ValueError:
        relative_source = str(audio_path)

    payload = {
        "source": relative_source,
        "language": getattr(info, "language", "tr"),
        "durationSec": round(float(getattr(info, "duration", 0.0)), 3),
        "fullText": " ".join(full_text_parts),
        "segments": segments_out,
    }

    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(
        f"[transcribe] Tamamlandı: {len(segments_out)} cümle segmenti -> {output_path}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

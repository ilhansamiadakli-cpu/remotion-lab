#!/usr/bin/env python3
"""
Tek Komutluk Veri Güdümlü Video Üretim Boru Hattı (script.md -> Ses -> Taslak -> Tip Doğrulama).

Kullanım:
    npm run produce
    npm run produce -- src/data/script.md --voice tr-TR-AhmetNeural --rate +3%
    .venv/bin/python scripts/pipeline.py src/data/script.md --speak-headings

GEMINI.md Güvenceleri:
- Taslak Öncelikli: Çıktılar `src/data/timeline_draft.json` ve `src/data/chapters_draft/` konumuna yazılır;
  kullanıcı onayı olmadan aktif `src/data/timeline.json` veya `src/data/chapters/*.json` dosyalarını ezmez.
- M1 Kaynak Koruması: Uzun video render'ını otomatik başlatmaz; `tsc --noEmit` ve tempo doğrulaması yapar.
- Kilitli Motor Sınırı: `src/theme.ts`, `src/engine/`, `src/components/`, `src/backgrounds/` değişmez.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
VENV_PYTHON = ROOT_DIR / ".venv" / "bin" / "python"
PYTHON_BIN = str(VENV_PYTHON) if VENV_PYTHON.is_file() else sys.executable

DEFAULT_SCRIPT = ROOT_DIR / "src" / "data" / "script.md"
DEFAULT_AUDIO = ROOT_DIR / "public" / "audio" / "kayit.wav"
DEFAULT_TRANSCRIPT = ROOT_DIR / "src" / "data" / "transcript.json"
DEFAULT_DRAFT = ROOT_DIR / "src" / "data" / "timeline_draft.json"
DEFAULT_CHAPTERS_DRAFT = ROOT_DIR / "src" / "data" / "chapters_draft"
DEFAULT_PRONUNCIATION = ROOT_DIR / "src" / "data" / "pronunciation.json"
DEFAULT_GLOSSARY = ROOT_DIR / "src" / "data" / "glossary.json"


def run_step(label: str, cmd: list[str]) -> None:
    print(f"\n=== [{label}] ===")
    print("$ " + " ".join(cmd))
    subprocess.run(cmd, cwd=str(ROOT_DIR), check=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Tek komutluk remotion-lab üretim boru hattı (edge-tts + WordBoundary + taslak + typecheck)."
    )
    parser.add_argument(
        "script",
        nargs="?",
        default=str(DEFAULT_SCRIPT),
        help="Anlatım betiği yolu (varsayılan: src/data/script.md)",
    )
    parser.add_argument("--voice", default="tr-TR-AhmetNeural", help="edge-tts sesi")
    parser.add_argument("--rate", default="+0%", help="Konuşma hızı (ör. +4%%, -3%%)")
    parser.add_argument("--pitch", default="+0Hz", help="Ses perdesi")
    parser.add_argument("--pause-sec", type=float, default=0.4, help="Bölüm arası nefes boşluğu (sn)")
    parser.add_argument("--speak-headings", action="store_true", help="## Bölüm başlıklarını da seslendir")
    parser.add_argument("--no-normalize", action="store_true", help="-14 LUFS normalizasyonu kapat")
    parser.add_argument("--fps", type=int, default=30, help="Hedef FPS (varsayılan: 30)")
    parser.add_argument(
        "--chapter-sec",
        type=float,
        default=60.0,
        help="script.md bölüm başlığı yoksa kullanılacak bölüm uzunluğu (sn)",
    )
    parser.add_argument("--audio-out", default=str(DEFAULT_AUDIO), help="Çıktı WAV yolu")
    parser.add_argument("--transcript-out", default=str(DEFAULT_TRANSCRIPT), help="Çıktı transcript JSON yolu")
    parser.add_argument("--draft-out", default=str(DEFAULT_DRAFT), help="Çıktı tekil taslak JSON yolu")
    parser.add_argument("--chapters-dir", default=str(DEFAULT_CHAPTERS_DRAFT), help="Çıktı bölüm taslak klasörü")
    parser.add_argument("--pronunciation", default=str(DEFAULT_PRONUNCIATION), help="Telaffuz sözlüğü JSON")
    parser.add_argument("--glossary", default=str(DEFAULT_GLOSSARY), help="Terim sözlüğü JSON")
    parser.add_argument("--skip-voice", action="store_true", help="Mevcut transcript.json ile ses adımını atla")
    parser.add_argument("--skip-typecheck", action="store_true", help="npm run typecheck adımını atla")
    return parser.parse_args()


def print_audit_summary(chapters_dir: Path, audio_out: Path) -> int:
    files = sorted(chapters_dir.glob("*.json"))
    if not files:
        print("\n[UYARI] Bölüm taslağı üretilmedi.")
        return 0

    print("\n=== [BORU HATTI ÖZETİ · TASLAK DOĞRULAMA] ===")
    total_beats = 0
    over_5 = 0
    total_sec = 0.0

    for f in files:
        spec = json.loads(f.read_text(encoding="utf-8"))
        dur = float(spec["meta"]["durationSec"])
        off = float(spec.get("audioOffsetSec", 0.0))
        beats = spec["beats"]
        bad = [b for b in beats if (b["endSec"] - b["startSec"]) > 5.0 + 1e-6]
        total_beats += len(beats)
        over_5 += len(bad)
        total_sec += dur
        max_b = max((b["endSec"] - b["startSec"]) for b in beats) if beats else 0.0
        print(
            f"  {f.name:34s} | offset={off:6.2f}s | dur={dur:5.2f}s | "
            f"beats={len(beats):2d} | max={max_b:.2f}s | >5sn={len(bad)}"
        )

    print(
        f"\n[OK] {len(files)} bölüm taslağı | {total_beats} sahne | "
        f"toplam {total_sec:.2f} sn | >5sn ihlali: {over_5}"
    )
    print(f"[OK] Ses çıktısı:     {audio_out}")
    print(f"[OK] Taslak klasörü:  {chapters_dir}")
    print("\nSonraki adımlar (onayınızla):")
    print(f"  1. Taslakları inceleyip üretime taşıyın: cp {chapters_dir}/*.json src/data/chapters/")
    print("  2. Remotion Studio önizleme:             npm run dev")
    print("  3. Tekil bölüm render:                   npm run build:chapter -- <ChapterId> out/test_bolum.mp4")
    return 1 if over_5 > 0 else 0


def main() -> int:
    args = parse_args()

    if not args.skip_voice:
        voice_cmd = [
            PYTHON_BIN,
            str(ROOT_DIR / "scripts" / "generate_voice.py"),
            args.script,
            "--voice",
            args.voice,
            "--rate",
            args.rate,
            "--pitch",
            args.pitch,
            "--pause-sec",
            str(args.pause_sec),
            "--pronunciation",
            args.pronunciation,
            "--audio-out",
            args.audio_out,
            "--transcript-out",
            args.transcript_out,
        ]
        if args.speak_headings:
            voice_cmd.append("--speak-headings")
        if args.no_normalize:
            voice_cmd.append("--no-normalize")
        run_step("1/3 · SES & WORDBOUNDARY ÜRETİMİ (edge-tts)", voice_cmd)

    # Transkriptte script.md bölüm başlıkları varsa --split-by-script, yoksa --split-chapters kullan
    transcript_path = Path(args.transcript_out).resolve()
    has_script_chapters = False
    if transcript_path.is_file():
        t_data = json.loads(transcript_path.read_text(encoding="utf-8"))
        has_script_chapters = bool(t_data.get("chapters"))

    plan_cmd = [
        PYTHON_BIN,
        str(ROOT_DIR / "scripts" / "plan_timeline.py"),
        "--input",
        args.transcript_out,
        "--output",
        args.draft_out,
        "--glossary",
        args.glossary,
        "--fps",
        str(args.fps),
        "--chapters-dir",
        args.chapters_dir,
    ]
    if has_script_chapters:
        plan_cmd.append("--split-by-script")
    else:
        plan_cmd.extend(["--split-chapters", str(args.chapter_sec)])

    run_step("2/3 · 3–5 SN TASLAK & BÖLÜM PLANLAMA", plan_cmd)

    if not args.skip_typecheck:
        run_step("3/3 · TYPESCRIPT DOĞRULAMA", ["npm", "run", "typecheck"])

    return print_audit_summary(Path(args.chapters_dir).resolve(), Path(args.audio_out).resolve())


if __name__ == "__main__":
    raise SystemExit(main())

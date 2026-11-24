#!/usr/bin/env python3
"""
Tek Komutluk Veri Güdümlü Video Üretim Boru Hattı (inbox/.md|.txt -> Ses -> Taslak -> Tip Doğrulama -> [Opsiyonel Render]).

Kullanım:
    npm run produce                                  # src/data/inbox/ (en yeni .md/.txt) veya src/data/script.md -> taslak
    npm run produce -- yol/dosya.md --rate +4%       # Belirli dosya -> taslak
    npm run produce -- --promote                     # Taslakları src/data/chapters/ içine terfi ettir
    npm run produce -- --render                      # Tam fabrika modu: ses + taslak + terfi + ChaptersVideo MP4 render

GEMINI.md Güvenceleri:
- Varsayılan Taslak Öncelikli: `--promote` veya `--render` verilmedikçe çıktı yalnızca
  `src/data/timeline_draft.json` ve `src/data/chapters_draft/` konumuna yazılır.
- M1 Kaynak Koruması: `--render` açıkça istenmedikçe uzun video render'ı başlatılmaz.
- Kilitli Motor Sınırı: `src/theme.ts`, `src/engine/`, `src/components/`, `src/backgrounds/` değişmez.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

from generate_voice import resolve_input_script

ROOT_DIR = Path(__file__).resolve().parent.parent
VENV_PYTHON = ROOT_DIR / ".venv" / "bin" / "python"
PYTHON_BIN = str(VENV_PYTHON) if VENV_PYTHON.is_file() else sys.executable

DEFAULT_AUDIO = ROOT_DIR / "public" / "audio" / "kayit.wav"
DEFAULT_TRANSCRIPT = ROOT_DIR / "src" / "data" / "transcript.json"
DEFAULT_DRAFT = ROOT_DIR / "src" / "data" / "timeline_draft.json"
DEFAULT_CHAPTERS_DRAFT = ROOT_DIR / "src" / "data" / "chapters_draft"
DEFAULT_CHAPTERS_PROD = ROOT_DIR / "src" / "data" / "chapters"
DEFAULT_PRONUNCIATION = ROOT_DIR / "src" / "data" / "pronunciation.json"
DEFAULT_GLOSSARY = ROOT_DIR / "src" / "data" / "glossary.json"
DEFAULT_RENDER_OUT = ROOT_DIR / "out" / "chapters.mp4"


def run_step(label: str, cmd: list[str]) -> None:
    print(f"\n=== [{label}] ===")
    print("$ " + " ".join(cmd))
    subprocess.run(cmd, cwd=str(ROOT_DIR), check=True)


def clear_json_dir(target_dir: Path) -> None:
    if not target_dir.is_dir():
        return
    for old_json in target_dir.glob("*.json"):
        old_json.unlink()


def promote_chapters(chapters_draft_dir: Path, chapters_prod_dir: Path) -> list[Path]:
    """Onaylanan bölüm taslaklarını aktif `src/data/chapters/` klasörüne taşır (.gitkeep korunur)."""
    drafts = sorted(chapters_draft_dir.glob("*.json"))
    if not drafts:
        raise RuntimeError(f"Terfi ettirilecek taslak bulunamadı: {chapters_draft_dir}")

    chapters_prod_dir.mkdir(parents=True, exist_ok=True)
    clear_json_dir(chapters_prod_dir)

    promoted: list[Path] = []
    for src_file in drafts:
        dst_file = chapters_prod_dir / src_file.name
        shutil.copy2(src_file, dst_file)
        promoted.append(dst_file)
    return promoted


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Tek komutluk remotion-lab üretim boru hattı (inbox/.md|.txt + edge-tts + taslak + opsiyonel render)."
    )
    parser.add_argument(
        "script",
        nargs="?",
        default=None,
        help="Anlatım betiği (.md/.txt). Boşsa src/data/inbox/ içindeki en yeni dosya, yoksa src/data/script.md seçilir",
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
    parser.add_argument(
        "--promote",
        action="store_true",
        help="Üretilen taslakları aktif src/data/chapters/ klasörüne taşır (eski aktif bölümleri değiştirir)",
    )
    parser.add_argument(
        "--render",
        action="store_true",
        help="Tam fabrika modu: taslakları src/data/chapters/ içine alır ve ChaptersVideo MP4 render'ını başlatır",
    )
    parser.add_argument(
        "--render-out",
        default=str(DEFAULT_RENDER_OUT),
        help="--render çıktısı MP4 yolu (varsayılan: out/chapters.mp4)",
    )
    return parser.parse_args()


def print_audit_summary(
    script_path: Path,
    source_mode: str,
    chapters_dir: Path,
    audio_out: Path,
    promoted: list[Path] | None = None,
    rendered_mp4: Path | None = None,
) -> int:
    files = sorted(chapters_dir.glob("*.json"))
    if not files:
        print("\n[UYARI] Bölüm taslağı üretilmedi.")
        return 0

    print("\n=== [BORU HATTI ÖZETİ · TASLAK DOĞRULAMA] ===")
    print(f"  Kaynak betik: {script_path.name} [{source_mode}]")
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

    if promoted:
        print(f"[OK] Aktif bölümler:  {len(promoted)} dosya -> src/data/chapters/")
    if rendered_mp4:
        print(f"[OK] Final Video:     {rendered_mp4}")
    elif not promoted:
        print("\nSonraki adımlar (onayınızla):")
        print("  1. Aktif bölümlere al:      make promote  (veya: npm run produce -- --promote)")
        print("  2. Remotion Studio önizleme: make dev")
        print("  3. Tam MP4 render:           make render")
    return 1 if over_5 > 0 else 0


def main() -> int:
    args = parse_args()
    script_path, source_mode = resolve_input_script(args.script)

    if not args.skip_voice:
        if not script_path.is_file():
            print(f"[HATA] Betik dosyası bulunamadı: {script_path}", file=sys.stderr)
            return 1
        voice_cmd = [
            PYTHON_BIN,
            str(ROOT_DIR / "scripts" / "generate_voice.py"),
            str(script_path),
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
        run_step(f"1/3 · SES & WORDBOUNDARY ÜRETİMİ ({source_mode}: {script_path.name})", voice_cmd)

    # Eski taslak kalıntılarını temizle
    chapters_dir = Path(args.chapters_dir).resolve()
    clear_json_dir(chapters_dir)

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
        str(chapters_dir),
    ]
    if has_script_chapters:
        plan_cmd.append("--split-by-script")
    else:
        plan_cmd.extend(["--split-chapters", str(args.chapter_sec)])

    run_step("2/3 · 3–5 SN TASLAK & BÖLÜM PLANLAMA", plan_cmd)

    if not args.skip_typecheck:
        run_step("3/3 · TYPESCRIPT DOĞRULAMA", ["npm", "run", "typecheck"])

    promoted_files: list[Path] | None = None
    rendered_mp4: Path | None = None

    if args.promote or args.render:
        promoted_files = promote_chapters(chapters_dir, DEFAULT_CHAPTERS_PROD)
        print(f"\n=== [TERFİ] {len(promoted_files)} bölüm -> src/data/chapters/ ===")

    if args.render:
        render_out = Path(args.render_out).resolve()
        render_out.parent.mkdir(parents=True, exist_ok=True)
        run_step(
            "4/4 · REMOTION TAM RENDER (ChaptersVideo)",
            ["npx", "remotion", "render", "ChaptersVideo", str(render_out)],
        )
        rendered_mp4 = render_out

    return print_audit_summary(
        script_path=script_path,
        source_mode=source_mode,
        chapters_dir=chapters_dir,
        audio_out=Path(args.audio_out).resolve(),
        promoted=promoted_files,
        rendered_mp4=rendered_mp4,
    )


if __name__ == "__main__":
    raise SystemExit(main())

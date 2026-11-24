#!/usr/bin/env python3
"""
Ücretsiz Otomatik Türkçe Ses Üreticisi & Kelime Zaman Damgası Çıkarıcı (edge-tts).

Kullanım:
    .venv/bin/python scripts/generate_voice.py
    .venv/bin/python scripts/generate_voice.py src/data/script.md --voice tr-TR-AhmetNeural --rate +4%
    .venv/bin/python scripts/generate_voice.py src/data/script.md --voice tr-TR-EmelNeural --speak-headings

Ne yapar?
1. `src/data/script.md` dosyasını `## Bölüm ...` başlıklarına göre bölümlere ayırır.
2. `src/data/pronunciation.json` sözlüğünü yalnızca TTS ses metnine uygular; ekranda ve
   `transcript.json` içinde temiz teknik yazımları (`MySQL 8.0`, `3NF`, `@Transactional` vb.) korur.
3. Microsoft Edge Neural TTS (`edge-tts`, `boundary="WordBoundary"`) ile her bölümü sentezler
   ve yerleşik kelime zaman damgalarını temiz ekran kelimelerine birebir hizalar (%0 Whisper ASR hatası).
4. Bölümleri aralarına `--pause-sec` (varsayılan 0.4 sn) doğal nefes boşluğu ekleyerek
   `public/audio/kayit.wav` (44.1 kHz mono, -14 LUFS) olarak birleştirir.
5. Mevcut `plan_timeline.py` ve `TimelineRenderer.tsx` ile %100 uyumlu `src/data/transcript.json` üretir.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

ROOT_DIR = Path(__file__).resolve().parent.parent
INBOX_DIR = ROOT_DIR / "src" / "data" / "inbox"
DEFAULT_SCRIPT = ROOT_DIR / "src" / "data" / "script.md"
DEFAULT_PRONUNCIATION = ROOT_DIR / "src" / "data" / "pronunciation.json"
DEFAULT_AUDIO_OUT = ROOT_DIR / "public" / "audio" / "kayit.wav"
DEFAULT_TRANSCRIPT_OUT = ROOT_DIR / "src" / "data" / "transcript.json"

TICKS_PER_SEC = 10_000_000.0  # edge-tts offset/duration birimi: 100 nanosaniye


def resolve_input_script(explicit_path: str | None) -> tuple[Path, str]:
    """
    Açık dosya verilmemişse önce `src/data/inbox/` içindeki en güncel `.md`/`.txt`
    dosyasını seçer; klasör boşsa `src/data/script.md` varsayılanına düşer.
    """
    if explicit_path:
        return Path(explicit_path).resolve(), "explicit"

    if INBOX_DIR.is_dir():
        candidates = [
            p
            for p in INBOX_DIR.iterdir()
            if p.is_file()
            and not p.name.startswith(".")
            and p.suffix.lower() in (".md", ".txt")
        ]
        if candidates:
            newest = max(candidates, key=lambda p: p.stat().st_mtime)
            return newest.resolve(), "inbox"

    return DEFAULT_SCRIPT.resolve(), "default"


@dataclass
class ScriptChapter:
    index: int
    title: str
    slug: str
    sentences: list[str]


@dataclass
class BoundaryEvent:
    text: str
    start_sec: float
    end_sec: float


@dataclass
class SynthesizedClip:
    mp3_bytes: bytes
    word_boundaries: list[BoundaryEvent]
    sentence_boundaries: list[BoundaryEvent]


class VoiceProvider(Protocol):
    """İleride farklı TTS sağlayıcıları (ör. ElevenLabs) eklenebilmesi için soyut arayüz."""

    async def synthesize(self, text: str) -> SynthesizedClip: ...


class EdgeTtsProvider:
    """Ücretsiz Microsoft Edge Neural TTS sağlayıcısı (WordBoundary zaman damgalı)."""

    def __init__(self, voice: str, rate: str = "+0%", pitch: str = "+0Hz") -> None:
        self.voice = voice
        self.rate = rate
        self.pitch = pitch

    async def synthesize(self, text: str) -> SynthesizedClip:
        try:
            import edge_tts
        except ImportError as exc:
            raise RuntimeError(
                "`edge-tts` paketi kurulu değil. Kurmak için: .venv/bin/pip install edge-tts"
            ) from exc

        communicate = edge_tts.Communicate(
            text=text,
            voice=self.voice,
            rate=self.rate,
            pitch=self.pitch,
            boundary="WordBoundary",
        )

        audio_chunks: list[bytes] = []
        word_events: list[BoundaryEvent] = []
        sent_events: list[BoundaryEvent] = []

        async for chunk in communicate.stream():
            ctype = chunk.get("type")
            if ctype == "audio":
                data = chunk.get("data")
                if data:
                    audio_chunks.append(data)
            elif ctype == "WordBoundary":
                start = float(chunk.get("offset", 0)) / TICKS_PER_SEC
                dur = float(chunk.get("duration", 0)) / TICKS_PER_SEC
                word_events.append(
                    BoundaryEvent(
                        text=str(chunk.get("text", "")).strip(),
                        start_sec=start,
                        end_sec=start + max(0.02, dur),
                    )
                )
            elif ctype == "SentenceBoundary":
                start = float(chunk.get("offset", 0)) / TICKS_PER_SEC
                dur = float(chunk.get("duration", 0)) / TICKS_PER_SEC
                sent_events.append(
                    BoundaryEvent(
                        text=str(chunk.get("text", "")).strip(),
                        start_sec=start,
                        end_sec=start + max(0.05, dur),
                    )
                )

        return SynthesizedClip(
            mp3_bytes=b"".join(audio_chunks),
            word_boundaries=word_events,
            sentence_boundaries=sent_events,
        )


def slugify_tr(text: str) -> str:
    tr_map = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    ascii_text = text.translate(tr_map).lower()
    # "Bölüm 1:" önekini dosya adında tekrarlama
    ascii_text = re.sub(r"^bolum\s*\d+\s*[:\-–.]?\s*", "", ascii_text)
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_text).strip("_")
    return slug[:32] or "bolum"


def clean_markdown_line(line: str) -> str:
    # HTML yorumlarını ve temel Markdown vurgularını temizle
    line = re.sub(r"<!--.*?-->", "", line)
    line = re.sub(r"\*\*(.+?)\*\*", r"\1", line)
    line = re.sub(r"\*(.+?)\*", r"\1", line)
    line = re.sub(r"`([^`]+)`", r"\1", line)
    line = re.sub(r"^\s*[-*]\s+", "", line)
    return re.sub(r"\s+", " ", line).strip()


def split_sentences(paragraph: str) -> list[str]:
    """Türkçe ondalık sayıları (8.0) ve sıra sayılarını (3. Normal) bölmeden cümlelere ayırır."""
    text = re.sub(r"\s+", " ", paragraph).strip()
    if not text:
        return []

    # Cümle sonu noktalama işaretlerinden sonra büyük harf/rakam başlangıcı
    parts: list[str] = []
    start = 0
    for m in re.finditer(r"([.!?]+)(\s+|$)", text):
        end_punct = m.end(1)
        next_pos = m.end()
        punct = m.group(1)
        prev_char = text[m.start() - 1] if m.start() > 0 else ""

        # "8.0" gibi ondalık sayıları bölme
        if punct == "." and prev_char.isdigit() and next_pos < len(text) and text[next_pos].isdigit():
            continue
        # "3. Normal Form" gibi sıra sayılarını bölme (tek nokta + rakam öncesi)
        if punct == "." and prev_char.isdigit():
            token_start = m.start() - 1
            while token_start > 0 and text[token_start - 1].isdigit():
                token_start -= 1
            num_token = text[token_start : m.start()]
            if len(num_token) <= 2 and (token_start == 0 or text[token_start - 1].isspace()):
                continue

        chunk = text[start:end_punct].strip()
        if chunk:
            parts.append(chunk)
        start = next_pos

    tail = text[start:].strip()
    if tail:
        parts.append(tail)
    return parts


def parse_script_markdown(path: Path, speak_headings: bool = False) -> tuple[str, list[ScriptChapter]]:
    raw = path.read_text(encoding="utf-8")
    doc_title = path.stem
    chapters: list[ScriptChapter] = []

    current_title: str | None = None
    current_paragraphs: list[str] = []
    para_buf: list[str] = []

    def flush_paragraph() -> None:
        nonlocal para_buf
        if para_buf:
            joined = " ".join(para_buf).strip()
            if joined:
                current_paragraphs.append(joined)
            para_buf = []

    def flush_chapter() -> None:
        nonlocal current_title, current_paragraphs
        flush_paragraph()
        if not current_paragraphs:
            return
        idx = len(chapters) + 1
        title = current_title or f"Bölüm {idx}"
        sentences: list[str] = []
        if speak_headings and current_title:
            heading_clean = re.sub(r"\s*\(~?[\d:\s–-]+\)\s*$", "", current_title).strip()
            if heading_clean and not heading_clean.endswith((".", "!", "?")):
                heading_clean += "."
            if heading_clean:
                sentences.append(heading_clean)
        for p in current_paragraphs:
            sentences.extend(split_sentences(p))
        if sentences:
            chapters.append(
                ScriptChapter(
                    index=idx,
                    title=title,
                    slug=slugify_tr(title),
                    sentences=sentences,
                )
            )
        current_paragraphs = []

    for raw_line in raw.splitlines():
        stripped = raw_line.strip()
        if stripped.startswith("# ") and not stripped.startswith("## "):
            doc_title = clean_markdown_line(stripped[2:])
            continue
        if stripped.startswith("## "):
            flush_chapter()
            current_title = clean_markdown_line(stripped[3:])
            continue
        if not stripped:
            flush_paragraph()
            continue
        cleaned = clean_markdown_line(stripped)
        if cleaned:
            para_buf.append(cleaned)

    flush_chapter()

    if not chapters:
        raise ValueError(f"Betik dosyasında okunacak metin bulunamadı: {path}")

    return doc_title, chapters


def load_pronunciation(path: Path) -> list[tuple[str, str]]:
    if not path.is_file():
        return []
    raw = json.loads(path.read_text(encoding="utf-8"))
    repl = raw.get("replacements", raw) if isinstance(raw, dict) else {}
    pairs = [
        (str(k), str(v))
        for k, v in repl.items()
        if isinstance(k, str) and isinstance(v, str) and not k.startswith("_") and k.strip()
    ]
    # En uzun eşleşme önce gelsin ("MySQL 8.0" -> "MySQL"den önce)
    pairs.sort(key=lambda kv: len(kv[0]), reverse=True)
    return pairs


def count_spoken_tokens(text: str) -> int:
    tokens = re.findall(r"[^\W_]+", text, flags=re.UNICODE)
    return max(1, len(tokens))


def build_speech_units(
    sentence: str,
    pronunciation_rules: list[tuple[str, str]],
) -> tuple[str, list[tuple[str, str, int]]]:
    """
    Cümleyi (display_chunk, speech_chunk, expected_spoken_words) birimlerine ayırır.
    Böylece TTS telaffuz genişletmeleri (ör. `3NF` -> `Üç Ne Fe`) zaman damgası
    hizalamasında tekrar temiz `3NF` ekran kelimesine geri eşlenir.
    """
    if not pronunciation_rules:
        units = [(tok, tok, count_spoken_tokens(tok)) for tok in sentence.split()]
        return sentence, units

    pattern_parts = []
    lookup: dict[str, str] = {}
    for src, dst in pronunciation_rules:
        lookup[src.casefold()] = dst
        esc = re.escape(src)
        # Başı/sonu harf-rakam ise kelime sınırı uygula; `@` veya boşluk gibi sembollerde serbest bırak
        prefix = r"(?<!\w)" if src[0].isalnum() else ""
        suffix = r"(?!\w)" if src[-1].isalnum() else ""
        pattern_parts.append(f"{prefix}{esc}{suffix}")

    regex = re.compile("(" + "|".join(pattern_parts) + ")", flags=re.IGNORECASE)

    units: list[tuple[str, str, int]] = []
    speech_parts: list[str] = []
    pos = 0

    for m in regex.finditer(sentence):
        if m.start() > pos:
            gap = sentence[pos : m.start()]
            speech_parts.append(gap)
            for tok in gap.split():
                units.append((tok, tok, count_spoken_tokens(tok)))

        matched_display = m.group(0)
        matched_speech = lookup.get(matched_display.casefold(), matched_display)
        speech_parts.append(matched_speech)

        clean_disp = matched_display.strip()
        clean_sp = matched_speech.strip()
        if clean_disp:
            units.append((clean_disp, clean_sp, count_spoken_tokens(clean_sp)))
        pos = m.end()

    if pos < len(sentence):
        tail = sentence[pos:]
        speech_parts.append(tail)
        for tok in tail.split():
            units.append((tok, tok, count_spoken_tokens(tok)))

    speech_text = re.sub(r"\s+", " ", "".join(speech_parts)).strip()
    return speech_text, units


def probe_duration_sec(audio_path: Path) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(audio_path),
    ]
    out = subprocess.check_output(cmd, text=True).strip()
    return float(out)


def align_chapter_words(
    sentences: list[str],
    pronunciation_rules: list[tuple[str, str]],
    word_boundaries: list[BoundaryEvent],
    chapter_duration_sec: float,
    chapter_offset_sec: float,
    start_seg_id: int,
) -> tuple[str, list[dict[str, Any]]]:
    """
    Bölüm içindeki cümlelerin ekran kelimelerini `WordBoundary` zaman damgalarına hizalar.
    WordBoundary yoksa bölüm süresine karakter ağırlıklı orantılı dağıtım (fallback) uygular.
    """
    sent_speech_texts: list[str] = []
    # (sent_idx, display_phrase, expected_spoken_tokens)
    flat_units: list[tuple[int, str, int]] = []

    for s_idx, sent in enumerate(sentences):
        sp_text, units = build_speech_units(sent, pronunciation_rules)
        sent_speech_texts.append(sp_text)
        for disp, _sp, exp_cnt in units:
            flat_units.append((s_idx, disp, exp_cnt))

    full_speech = " ".join(sent_speech_texts)

    # Her birim için yerel [start, end] aralığını hesapla
    unit_spans: list[tuple[int, str, float, float]] = []

    if word_boundaries and flat_units:
        total_expected = sum(u[2] for u in flat_units)
        n_wb = len(word_boundaries)
        cursor_exp = 0.0

        for s_idx, disp, exp_cnt in flat_units:
            # Beklenen konuşma token konumunu gerçek WordBoundary dizinine oranla eşle
            i0 = int(round((cursor_exp / max(1, total_expected)) * n_wb))
            cursor_exp += exp_cnt
            i1 = int(round((cursor_exp / max(1, total_expected)) * n_wb)) - 1

            i0 = max(0, min(n_wb - 1, i0))
            i1 = max(i0, min(n_wb - 1, i1))

            u_start = word_boundaries[i0].start_sec
            u_end = word_boundaries[i1].end_sec
            if u_end <= u_start:
                u_end = u_start + 0.08
            unit_spans.append((s_idx, disp, u_start, u_end))
    else:
        # Güvenli fallback: karakter uzunluğuna göre orantılı zamanlama
        weights = [max(2, len(u[1])) for u in flat_units]
        total_w = float(sum(weights) or 1)
        cur_t = 0.0
        for (s_idx, disp, _exp), w in zip(flat_units, weights):
            dur = (w / total_w) * max(0.2, chapter_duration_sec)
            unit_spans.append((s_idx, disp, cur_t, cur_t + dur))
            cur_t += dur

    # Çok kelimeli display birimlerini (ör. "MySQL 8.0", "Foreign Key") tekil ekran kelimelerine böl
    words_by_sent: list[list[dict[str, Any]]] = [[] for _ in sentences]
    for s_idx, disp, u_start, u_end in unit_spans:
        sub_words = disp.split()
        if len(sub_words) == 1:
            words_by_sent[s_idx].append(
                {
                    "word": sub_words[0],
                    "startSec": round(chapter_offset_sec + u_start, 3),
                    "endSec": round(chapter_offset_sec + u_end, 3),
                    "probability": 1.0,
                }
            )
        else:
            sub_weights = [max(1, len(sw)) for sw in sub_words]
            tot_sw = float(sum(sub_weights))
            span = max(0.04, u_end - u_start)
            cur = u_start
            for sw, sw_w in zip(sub_words, sub_weights):
                dt = span * (sw_w / tot_sw)
                words_by_sent[s_idx].append(
                    {
                        "word": sw,
                        "startSec": round(chapter_offset_sec + cur, 3),
                        "endSec": round(chapter_offset_sec + cur + dt, 3),
                        "probability": 1.0,
                    }
                )
                cur += dt

    segments: list[dict[str, Any]] = []
    for s_idx, sent in enumerate(sentences):
        s_words = words_by_sent[s_idx]
        if not s_words:
            continue
        seg_start = s_words[0]["startSec"]
        seg_end = s_words[-1]["endSec"]
        segments.append(
            {
                "id": start_seg_id + len(segments),
                "startSec": seg_start,
                "endSec": seg_end,
                "text": sent,
                "words": s_words,
            }
        )

    return full_speech, segments


def concat_and_master_wav(
    chapter_mp3_paths: list[Path],
    pause_sec: float,
    output_wav: Path,
    normalize: bool = True,
) -> float:
    """Bölüm MP3 dosyalarını aralarında pause_sec boşlukla 44.1kHz mono WAV olarak birleştirir."""
    output_wav.parent.mkdir(parents=True, exist_ok=True)
    n = len(chapter_mp3_paths)
    if n == 0:
        raise ValueError("Birleştirilecek ses dosyası yok.")

    cmd: list[str] = ["ffmpeg", "-y"]
    for p in chapter_mp3_paths:
        cmd.extend(["-i", str(p)])

    filter_parts: list[str] = []
    for i in range(n):
        filter_parts.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=mono[a{i}]")

    if n > 1 and pause_sec > 0:
        cmd.extend(["-f", "lavfi", "-t", f"{pause_sec:.3f}", "-i", "anullsrc=r=44100:cl=mono"])
        sil_idx = n
        if n - 1 == 1:
            filter_parts.append(f"[{sil_idx}:a]acopy[s0]")
        else:
            sil_labels = "".join(f"[s{k}]" for k in range(n - 1))
            filter_parts.append(f"[{sil_idx}:a]asplit={n - 1}{sil_labels}")
        chain = []
        for i in range(n):
            chain.append(f"[a{i}]")
            if i < n - 1:
                chain.append(f"[s{i}]")
        concat_in = "".join(chain)
        concat_n = 2 * n - 1
    else:
        concat_in = "".join(f"[a{i}]" for i in range(n))
        concat_n = n

    if normalize:
        filter_parts.append(
            f"{concat_in}concat=n={concat_n}:v=0:a=1,"
            "highpass=f=75,loudnorm=I=-14:TP=-1.5:LRA=11[out]"
        )
    else:
        filter_parts.append(f"{concat_in}concat=n={concat_n}:v=0:a=1[out]")

    cmd.extend(
        [
            "-filter_complex",
            ";".join(filter_parts),
            "-map",
            "[out]",
            "-acodec",
            "pcm_s16le",
            "-ar",
            "44100",
            "-ac",
            "1",
            str(output_wav),
            "-loglevel",
            "error",
        ]
    )

    subprocess.run(cmd, check=True)
    return probe_duration_sec(output_wav)


async def generate_all(args: argparse.Namespace) -> int:
    script_path, source_mode = resolve_input_script(args.script)
    pron_path = Path(args.pronunciation).resolve()
    audio_out = Path(args.audio_out).resolve()
    transcript_out = Path(args.transcript_out).resolve()

    if not script_path.is_file():
        print(f"[HATA] Betik dosyası bulunamadı: {script_path}", file=sys.stderr)
        return 1

    doc_title, chapters = parse_script_markdown(script_path, speak_headings=args.speak_headings)
    pron_rules = load_pronunciation(pron_path)
    provider = EdgeTtsProvider(voice=args.voice, rate=args.rate, pitch=args.pitch)

    source_tag = "inbox (otomatik)" if source_mode == "inbox" else source_mode
    print(f"[voice] Betik: {script_path.name} [{source_tag}] ({len(chapters)} bölüm) | Başlık: {doc_title}")
    print(f"[voice] Sağlayıcı: edge-tts | Ses: {args.voice} | Hız: {args.rate} | Telaffuz kuralı: {len(pron_rules)}")

    all_segments: list[dict[str, Any]] = []
    chapter_meta_out: list[dict[str, Any]] = []

    with tempfile.TemporaryDirectory(prefix="remotion_voice_") as tmp:
        tmp_dir = Path(tmp)
        mp3_paths: list[Path] = []
        cum_offset = 0.0

        for ch in chapters:
            speech_parts = [build_speech_units(s, pron_rules)[0] for s in ch.sentences]
            chapter_speech = " ".join(speech_parts)

            clip = await provider.synthesize(chapter_speech)
            mp3_file = tmp_dir / f"ch_{ch.index:02d}.mp3"
            mp3_file.write_bytes(clip.mp3_bytes)
            mp3_paths.append(mp3_file)

            ch_dur = probe_duration_sec(mp3_file)
            _, ch_segments = align_chapter_words(
                sentences=ch.sentences,
                pronunciation_rules=pron_rules,
                word_boundaries=clip.word_boundaries,
                chapter_duration_sec=ch_dur,
                chapter_offset_sec=cum_offset,
                start_seg_id=len(all_segments),
            )
            all_segments.extend(ch_segments)

            # Bölüm bitişi: son bölüm değilse nefes boşluğunun yarısına kadar kapsa
            is_last = ch.index == len(chapters)
            pad_after = 0.0 if is_last else args.pause_sec
            ch_end = round(cum_offset + ch_dur + (pad_after / 2.0 if not is_last else 0.0), 3)
            ch_start = round(cum_offset - (args.pause_sec / 2.0 if ch.index > 1 else 0.0), 3)

            chapter_meta_out.append(
                {
                    "index": ch.index,
                    "title": ch.title,
                    "slug": ch.slug,
                    "startSec": max(0.0, ch_start),
                    "endSec": ch_end,
                    "speechDurationSec": round(ch_dur, 3),
                    "wordBoundaryCount": len(clip.word_boundaries),
                }
            )

            print(
                f"        - Bölüm {ch.index:02d} ({ch.title}): {ch_dur:5.2f}s | "
                f"{len(ch.sentences)} cümle | {len(clip.word_boundaries)} WordBoundary"
            )
            cum_offset += ch_dur + pad_after

        total_wav_dur = concat_and_master_wav(
            chapter_mp3_paths=mp3_paths,
            pause_sec=args.pause_sec,
            output_wav=audio_out,
            normalize=not args.no_normalize,
        )

    # Son bölümün bitişini gerçek WAV süresine kilitle
    if chapter_meta_out:
        chapter_meta_out[-1]["endSec"] = round(total_wav_dur, 3)

    try:
        rel_audio = str(audio_out.relative_to(ROOT_DIR))
    except ValueError:
        rel_audio = str(audio_out)

    payload: dict[str, Any] = {
        "source": rel_audio,
        "generator": f"edge-tts ({args.voice})",
        "title": doc_title,
        "language": "tr",
        "durationSec": round(total_wav_dur, 3),
        "fullText": " ".join(s["text"] for s in all_segments),
        "chapters": chapter_meta_out,
        "segments": all_segments,
    }

    transcript_out.parent.mkdir(parents=True, exist_ok=True)
    transcript_out.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"[voice] Ses kaydedildi:        {audio_out} ({total_wav_dur:.2f} sn, 44.1kHz mono)")
    print(f"[voice] Transkript kaydedildi: {transcript_out} ({len(all_segments)} cümle, %0 ASR hatası)")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="script.md -> edge-tts (ücretsiz Türkçe ses) + WordBoundary transcript.json üreticisi."
    )
    parser.add_argument(
        "script",
        nargs="?",
        default=None,
        help="Girdi .md/.txt betiği (boş bırakılırsa: src/data/inbox/ içindeki en yeni dosya, yoksa src/data/script.md)",
    )
    parser.add_argument(
        "--voice",
        default="tr-TR-AhmetNeural",
        help="edge-tts sesi (ör. tr-TR-AhmetNeural, tr-TR-EmelNeural)",
    )
    parser.add_argument("--rate", default="+0%", help="Konuşma hızı (ör. +5%%, -5%%)")
    parser.add_argument("--pitch", default="+0Hz", help="Ses perdesi (ör. -2Hz, +2Hz)")
    parser.add_argument(
        "--pause-sec",
        type=float,
        default=0.4,
        help="Bölümler arası doğal nefes boşluğu saniyesi (varsayılan: 0.4)",
    )
    parser.add_argument(
        "--pronunciation",
        default=str(DEFAULT_PRONUNCIATION),
        help="Teknik terim telaffuz sözlüğü (varsayılan: src/data/pronunciation.json)",
    )
    parser.add_argument(
        "--audio-out",
        default=str(DEFAULT_AUDIO_OUT),
        help="Çıktı birleşik WAV dosyası (varsayılan: public/audio/kayit.wav)",
    )
    parser.add_argument(
        "--transcript-out",
        default=str(DEFAULT_TRANSCRIPT_OUT),
        help="Çıktı kelime zaman damgalı JSON (varsayılan: src/data/transcript.json)",
    )
    parser.add_argument(
        "--speak-headings",
        action="store_true",
        help="## Bölüm başlıklarını da seslendir (varsayılan: yalnızca yapısal ayırıcı)",
    )
    parser.add_argument(
        "--no-normalize",
        action="store_true",
        help="-14 LUFS loudness normalizasyonunu atla",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    return asyncio.run(generate_all(args))


if __name__ == "__main__":
    raise SystemExit(main())

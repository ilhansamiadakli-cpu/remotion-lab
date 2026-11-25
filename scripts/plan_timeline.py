#!/usr/bin/env python3
"""
Yarı Otomatik Zaman Çizelgesi Planlayıcı v3 (`scripts/plan_timeline.py`)

Özellikler:
1. `src/data/glossary.json` terim & ASR düzeltme sözlüğünü uygular (ör. `300 mm -> 300 ml`,
   `mysql -> MySQL`, `spring boot -> Spring Boot`, `pincağında -> fincanda`).
2. `src/data/transcript.json` içindeki kelime zaman damgalarıyla tüm konuşmayı sıkı
   3–5 saniyelik sahne bloklarına (beats) böler (0 adet >5sn ihlali).
3. Konuşma metnindeki anahtar kelimelere göre 10 kilitli bileşenden en uygununu atar:
   - 'curl', 'http', '409', '201', 'endpoint', 'json', 'istek', 'yanıt', 'api' -> TerminalTrace
   - 'kod', 'sorgu', 'sql', 'select', 'tablo', 'java', 'bash', 'constraint'    -> CodeWindow
   - 'performans', 'milisaniye', 'hız', 'explain', 'indeks', 'latency', 'ms'   -> SplitStage
   - 'fark', 'yerine', 'değil', 'hatalı', 'yanlış', 'eski', 'yeni'             -> ComparisonCard
   - 'örnek', 'ekranda', 'gördüğünüz', 'şema', 'arayüz', 'görsel'              -> MediaWindow
   - 'adım', 'sırayla', 'ardından', 'aşama', 'ön ıslatma', 'tamamlarsanız'     -> StepCard
   - 'oran', 'akış', 'bağlantı', 'sonucu', 'yakarsınız'                        -> NodeFlow
   - Belirgin sayısal kural / başlık vurgusu                                    -> MetricBanner
   - Varsayılan                                                                 -> HighlighterText / GlassCard
4. `HighlighterText` sahnelerinde `transcript.json` kelime saniyelerinden tam
   `highlightAtSecs` dizisini otomatik hesaplar!
5. `--split-chapters 60` ile 5 dakikalık kayıtları M1 MacBook Air dostu 60 saniyelik
   `chapters/` JSON dosyalarına otomatik böler.

Kullanım:
    npm run plan
    npm run plan -- --split-chapters 60 --chapters-dir src/data/chapters_draft
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_INPUT = ROOT_DIR / "src" / "data" / "transcript.json"
DEFAULT_OUTPUT = ROOT_DIR / "src" / "data" / "timeline_draft.json"
DEFAULT_GLOSSARY = ROOT_DIR / "src" / "data" / "glossary.json"
DEFAULT_DIRECTOR = ROOT_DIR / "src" / "config" / "director.json"

DEFAULT_DIRECTOR_CONFIG: dict[str, Any] = {
    "activeTheme": "obsidianAmber",
    "timing": {
        "speechLeadPaddingSec": 0.25,
        "speechTailPaddingSec": 0.45,
        "minSceneDurationSec": 3.5,
        "maxSceneDurationSec": 6.0,
        "animationStartOffsetSec": 0.15,
    },
    "transitions": {
        "defaultType": "fade-slide",
        "durationFrames": 18,
        "springDamping": 16,
        "springStiffness": 110,
    },
    "previewRender": {
        "scale": 0.5,
        "crf": 28,
    },
}


def load_director_config(path: Path = DEFAULT_DIRECTOR) -> dict[str, Any]:
    """`src/config/director.json` merkezi yönetmen konfigürasyonunu okur (eksik alanlar için güvenli varsayılanlarla)."""
    cfg = json.loads(json.dumps(DEFAULT_DIRECTOR_CONFIG))
    if not path.is_file():
        return cfg
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return cfg
    if isinstance(raw.get("activeTheme"), str) and raw["activeTheme"].strip():
        cfg["activeTheme"] = raw["activeTheme"].strip()
    for section in ("timing", "transitions", "previewRender"):
        if isinstance(raw.get(section), dict):
            cfg[section].update(raw[section])
    return cfg


def tr_lower(text: str) -> str:
    return text.replace("İ", "i").replace("I", "ı").lower()


def clean_sentence(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def load_glossary(path: Path) -> list[tuple[re.Pattern[str], str]]:
    """`glossary.json` dosyasını en uzun ifadeden en kısaya doğru regex kurallarına derler."""
    if not path.is_file():
        return []
    raw = json.loads(path.read_text(encoding="utf-8"))
    mapping: dict[str, str] = raw.get("replacements") or {}
    sorted_items = sorted(mapping.items(), key=lambda kv: len(kv[0]), reverse=True)
    compiled: list[tuple[re.Pattern[str], str]] = []
    for src, dst in sorted_items:
        if not src.strip():
            continue
        pattern = re.compile(rf"(?<!\w){re.escape(src)}(?!\w)", re.IGNORECASE)
        compiled.append((pattern, dst))
    return compiled


def apply_glossary(text: str, rules: list[tuple[re.Pattern[str], str]]) -> str:
    out = text
    for pat, repl in rules:
        def _preserve_initial_cap(match: re.Match[str], r: str = repl) -> str:
            matched = match.group(0)
            # Eğer cümle başında büyük harfle başlıyorsa ve hedef küçük harfle başlıyorsa baş harfi koru
            if matched and matched[0].isupper() and r and r[0].islower():
                first = "İ" if r[0] == "i" else "I" if r[0] == "ı" else r[0].upper()
                return first + r[1:]
            return r

        out = pat.sub(_preserve_initial_cap, out)
    return clean_sentence(out)


def split_segment_by_words(seg: dict[str, Any], max_sec: float = 4.7) -> list[dict[str, Any]]:
    """5 saniyeden uzun segmentleri kelime zaman damgalarından dengeli olarak böler."""
    start = float(seg["startSec"])
    end = float(seg["endSec"])
    dur = end - start
    words = seg.get("words") or []

    if dur <= max_sec or len(words) < 4:
        return [{"startSec": start, "endSec": end, "text": clean_sentence(seg["text"]), "words": words}]

    parts_count = max(2, int((dur + max_sec - 0.01) // max_sec) + 1)
    if dur / (parts_count - 1) <= max_sec:
        parts_count -= 1
    target_step = dur / parts_count

    conjunctions = {"ve", "ama", "ancak", "fakat", "ardından", "sonra", "ile", "çünkü", "ise"}
    chunks: list[dict[str, Any]] = []
    cur_start_idx = 0

    for p in range(1, parts_count):
        target_time = start + p * target_step
        best_idx = cur_start_idx + 1
        best_score = float("inf")

        for idx in range(cur_start_idx + 2, len(words) - 1):
            w_time = float(words[idx]["startSec"])
            dist = abs(w_time - target_time)
            w_clean = tr_lower(words[idx]["word"].strip(".,;:!?"))
            prev_word = words[idx - 1]["word"]
            bonus = 0.0
            if prev_word.endswith((",", ".", ";")):
                bonus -= 0.35
            if w_clean in conjunctions:
                bonus -= 0.25
            score = dist + bonus
            if score < best_score:
                best_score = score
                best_idx = idx

        sub_words = words[cur_start_idx:best_idx]
        if sub_words:
            chunks.append(
                {
                    "startSec": float(sub_words[0]["startSec"]),
                    "endSec": float(sub_words[-1]["endSec"]),
                    "text": clean_sentence(" ".join(w["word"] for w in sub_words)),
                    "words": sub_words,
                }
            )
            cur_start_idx = best_idx

    tail_words = words[cur_start_idx:]
    if tail_words:
        chunks.append(
            {
                "startSec": float(tail_words[0]["startSec"]),
                "endSec": end,
                "text": clean_sentence(" ".join(w["word"] for w in tail_words)),
                "words": tail_words,
            }
        )
    return chunks


def compute_seam_time(
    prev_end: float,
    next_start: float,
    lead_pad_sec: float,
    tail_pad_sec: float,
) -> float:
    """İki konuşma bloğu arasındaki geçiş noktasını `speechLeadPaddingSec` ve `speechTailPaddingSec` ile dengeler."""
    gap = next_start - prev_end
    if gap <= 0.01:
        return round((prev_end + next_start) / 2.0, 2)
    total_pad = max(0.05, lead_pad_sec + tail_pad_sec)
    if gap >= total_pad:
        # Yeni konuşmadan tam `lead_pad_sec` önce sahneye geç (nefes payı korunsun)
        return round(next_start - lead_pad_sec, 2)
    # Boşluk darsa tail/lead oranına göre bölüştür
    weight_tail = tail_pad_sec / total_pad
    return round(prev_end + gap * weight_tail, 2)


def build_timed_blocks(
    segments: list[dict[str, Any]],
    total_duration: float,
    director: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Segmentleri `director.json` zamanlama sınırlarına uygun kesintisiz beat bloklarına dönüştürür."""
    timing = (director or DEFAULT_DIRECTOR_CONFIG)["timing"]
    min_beat_sec = float(timing.get("minSceneDurationSec", 3.5))
    max_beat_sec = float(timing.get("maxSceneDurationSec", 6.0))
    lead_pad_sec = float(timing.get("speechLeadPaddingSec", 0.25))
    tail_pad_sec = float(timing.get("speechTailPaddingSec", 0.45))

    if not segments:
        return [
            {
                "startSec": 0.0,
                "endSec": round(max(min_beat_sec, total_duration), 3),
                "text": "Örnek anlatım bloğu.",
                "words": [],
            }
        ]

    raw_blocks: list[dict[str, Any]] = []
    split_cap = max(min_beat_sec + 0.5, max_beat_sec - 0.35)
    for seg in segments:
        raw_blocks.extend(split_segment_by_words(seg, max_sec=split_cap))

    merged: list[dict[str, Any]] = []
    for blk in raw_blocks:
        if not merged:
            merged.append(blk)
            continue
        prev = merged[-1]
        prev_dur = prev["endSec"] - prev["startSec"]
        combined_dur = blk["endSec"] - prev["startSec"]
        if prev_dur < min_beat_sec and combined_dur <= max_beat_sec - 0.1:
            prev["endSec"] = blk["endSec"]
            prev["text"] = clean_sentence(f"{prev['text']} {blk['text']}")
            prev["words"] = (prev.get("words") or []) + (blk.get("words") or [])
        else:
            merged.append(blk)

    if len(merged) >= 2:
        last = merged[-1]
        prev = merged[-2]
        if (total_duration - last["startSec"]) < min_beat_sec:
            combined_span = total_duration - prev["startSec"]
            combined_text = clean_sentence(f"{prev['text']} {last['text']}")
            combined_words = (prev.get("words") or []) + (last.get("words") or [])
            if combined_span <= max_beat_sec:
                prev["endSec"] = total_duration
                prev["text"] = combined_text
                prev["words"] = combined_words
                merged.pop()
            else:
                merged[-2:] = split_segment_by_words(
                    {
                        "startSec": prev["startSec"],
                        "endSec": total_duration,
                        "text": combined_text,
                        "words": combined_words,
                    },
                    max_sec=combined_span / 2.0 + 0.25,
                )

    merged[0]["startSec"] = 0.0
    for i in range(len(merged) - 1):
        seam = compute_seam_time(
            merged[i]["endSec"],
            merged[i + 1]["startSec"],
            lead_pad_sec,
            tail_pad_sec,
        )
        merged[i]["endSec"] = seam
        merged[i + 1]["startSec"] = seam
    merged[-1]["endSec"] = round(total_duration, 3)

    final_blocks: list[dict[str, Any]] = []
    for blk in merged:
        dur = blk["endSec"] - blk["startSec"]
        if dur > max_beat_sec:
            sub = split_segment_by_words(blk, max_sec=max_beat_sec - 0.25)
            sub[0]["startSec"] = blk["startSec"]
            for j in range(len(sub) - 1):
                seam = compute_seam_time(
                    sub[j]["endSec"],
                    sub[j + 1]["startSec"],
                    lead_pad_sec,
                    tail_pad_sec,
                )
                sub[j]["endSec"] = seam
                sub[j + 1]["startSec"] = seam
            sub[-1]["endSec"] = blk["endSec"]
            final_blocks.extend(sub)
        else:
            final_blocks.append(blk)

    # Çift komşu dengelemeli min/max süre kuralı güvencesi
    for _ in range(16):
        changed = False
        i = 0
        while i < len(final_blocks):
            dur = final_blocks[i]["endSec"] - final_blocks[i]["startSec"]
            if dur < min_beat_sec - 1e-6:
                if i + 1 < len(final_blocks) and (final_blocks[i + 1]["endSec"] - final_blocks[i]["startSec"]) <= max_beat_sec:
                    final_blocks[i]["endSec"] = final_blocks[i + 1]["endSec"]
                    final_blocks[i]["text"] = clean_sentence(f"{final_blocks[i]['text']} {final_blocks[i + 1]['text']}")
                    final_blocks[i]["words"] = (final_blocks[i].get("words") or []) + (final_blocks[i + 1].get("words") or [])
                    final_blocks.pop(i + 1)
                    changed = True
                    continue
                if i > 0 and (final_blocks[i]["endSec"] - final_blocks[i - 1]["startSec"]) <= max_beat_sec:
                    final_blocks[i - 1]["endSec"] = final_blocks[i]["endSec"]
                    final_blocks[i - 1]["text"] = clean_sentence(f"{final_blocks[i - 1]['text']} {final_blocks[i]['text']}")
                    final_blocks[i - 1]["words"] = (final_blocks[i - 1].get("words") or []) + (final_blocks[i].get("words") or [])
                    final_blocks.pop(i)
                    changed = True
                    continue

                needed = round(min_beat_sec - dur + 0.04, 2)
                next_slack = (
                    max(0.0, (final_blocks[i + 1]["endSec"] - final_blocks[i + 1]["startSec"]) - min_beat_sec)
                    if i + 1 < len(final_blocks)
                    else 0.0
                )
                prev_slack = (
                    max(0.0, (final_blocks[i - 1]["endSec"] - final_blocks[i - 1]["startSec"]) - min_beat_sec)
                    if i > 0
                    else 0.0
                )
                # İki komşudan toplamda yeterli pay varsa bölüşerek dengele
                if next_slack + prev_slack >= needed and (next_slack > 0.02 or prev_slack > 0.02):
                    take_next = round(min(next_slack, needed), 2)
                    take_prev = round(min(prev_slack, max(0.0, needed - take_next)), 2)
                    if take_next > 0:
                        seam_r = round(final_blocks[i]["endSec"] + take_next, 2)
                        final_blocks[i]["endSec"] = seam_r
                        final_blocks[i + 1]["startSec"] = seam_r
                        changed = True
                    if take_prev > 0:
                        seam_l = round(final_blocks[i]["startSec"] - take_prev, 2)
                        final_blocks[i - 1]["endSec"] = seam_l
                        final_blocks[i]["startSec"] = seam_l
                        changed = True
            i += 1
        if not changed:
            break

    return final_blocks


def extract_key_phrases(text: str) -> list[str]:
    """HighlighterText için cümledeki en anlamlı 1–2 kilit ifadeyi seçer."""
    words = [w.strip(".,;:!?\"'") for w in text.split() if len(w.strip(".,;:!?\"'")) > 0]
    stopwords = {
        "ve", "ile", "bir", "bu", "şu", "o", "da", "de", "için", "gibi", "ise",
        "daha", "en", "çok", "az", "ama", "fakat", "ancak", "neden", "aslında",
        "üzerine", "ortaya", "sadece", "şekilde", "arasında", "arasındadır",
    }

    num_match = re.search(r"\b\d+(?:\s+(?:ile|-)\s+\d+)?\s+[A-Za-zÇĞİÖŞÜçğıöşü°%]+", text)
    highlights: list[str] = []
    if num_match:
        highlights.append(num_match.group(0).strip(".,;:!?"))

    content_indices = [
        i for i, w in enumerate(words) if len(w) >= 4 and tr_lower(w) not in stopwords
    ]
    if content_indices:
        mid_idx = content_indices[len(content_indices) // 2]
        if mid_idx + 1 < len(words) and len(words[mid_idx + 1]) >= 3:
            phrase = f"{words[mid_idx]} {words[mid_idx + 1]}"
        else:
            phrase = words[mid_idx]
        if all(tr_lower(phrase) not in tr_lower(h) for h in highlights):
            highlights.append(phrase)

    return highlights[:2] if highlights else [text]


def resolve_highlight_timestamps(
    highlights: list[str],
    beat_start_sec: float,
    beat_dur_sec: float,
    words: list[dict[str, Any]],
    glossary_rules: list[tuple[re.Pattern[str], str]],
    anim_offset_sec: float = 0.15,
) -> list[float]:
    """
    `transcript.json` kelime zaman damgalarından her vurgulanan ifadenin
    beat içi tam telaffuz saniyesini (`highlightAtSecs`) hesaplar.
    """
    if not highlights:
        return []

    norm_words = [
        (
            tr_lower(apply_glossary(w.get("word", ""), glossary_rules).strip(".,;:!?\"'")),
            float(w.get("startSec", beat_start_sec)),
        )
        for w in words
    ]

    min_sec = max(0.05, anim_offset_sec)
    result: list[float] = []
    for idx, phrase in enumerate(highlights):
        first_token = tr_lower(phrase.split()[0].strip(".,;:!?\"'")) if phrase.split() else ""
        matched_sec: float | None = None

        for w_txt, w_start in norm_words:
            if not first_token or not w_txt:
                continue
            if first_token == w_txt or (len(first_token) >= 4 and (first_token in w_txt or w_txt in first_token)):
                local_sec = max(min_sec, min(beat_dur_sec - 0.5, w_start - beat_start_sec))
                matched_sec = round(local_sec, 2)
                break

        if matched_sec is None:
            fallback = min(beat_dur_sec - 0.5, max(min_sec + 0.15, 0.35) + idx * 0.75)
            matched_sec = round(max(min_sec, fallback), 2)

        result.append(matched_sec)
    return result


def extract_metric(text: str) -> tuple[str, str] | None:
    m = re.search(
        r"(\d+(?:\s*(?:ile|-|–)\s*\d+)?\s*(?:derece|°C|tablo|gram|g|ml|ms|saniye|sn|%|MB|MHz|temel\s+\w+))",
        text,
        re.IGNORECASE,
    )
    if not m:
        return None
    val = m.group(1).strip().upper()
    return val, "KRİTİK PARAMETRE"


def classify_component(text: str, index: int, prev_component: str | None) -> str:
    """Konuşma metnindeki anahtar kelimelere göre 13 kilitli bileşenden en uygununu seçer."""
    lower = tr_lower(text)

    ref_kw = ("kaynakça", "referans", "github", "kaynak kod", "dokümantasyon", "açıklama kısmında")
    memory_kw = ("hunk", "arena", "z_malloc", "malloc", "parçalanma", "fragmentation", "pointer", "bellek bloğ", "heap")
    raycast_kw = ("raycast", "görüş konisi", "görünürlük ışın", "fov", "pvs", "bsp ağac", "ışın")
    terminal_kw = ("curl", "http", "409", "201", "endpoint", "json", "istek", "yanıt", "rest api", "status")
    code_kw = ("kod", "sorgu", "sql", "select", "tablo", "java", "bash", "script", "constraint", "transactional")
    split_kw = ("performans", "milisaniye", "hız", "explain", "indeks", "index", "latency", "ms")
    media_kw = ("örnek", "ekranda", "gördüğünüz", "ekran", "arayüz", "şema", "görsel")
    compare_kw = ("fark", "yerine", "karşı", "değil", "hatalı", "yanlış", "eski", "yeni")
    step_kw = ("adım", "sırayla", "ardından", "aşama", "saniye", "ön ıslatma", "tamamlarsanız")
    flow_kw = ("oran", "akış", "bağlanır", "sonucu", "yakarsınız", "çıkar")

    if any(k in lower for k in ref_kw):
        return "ReferenceList"
    if any(k in lower for k in memory_kw) and prev_component != "MemoryBarSim":
        return "MemoryBarSim"
    if any(k in lower for k in raycast_kw) and prev_component != "RayCastConeSim":
        return "RayCastConeSim"
    if any(k in lower for k in terminal_kw):
        return "TerminalTrace"
    if any(k in lower for k in code_kw):
        return "CodeWindow"
    if any(k in lower for k in split_kw):
        return "SplitStage"
    if any(k in lower for k in media_kw):
        return "MediaWindow"
    if any(k in lower for k in step_kw):
        return "StepCard"
    if any(k in lower for k in compare_kw):
        return "ComparisonCard"
    if any(k in lower for k in flow_kw):
        return "NodeFlow"

    if extract_metric(text) and len(text) <= 72 and prev_component != "MetricBanner":
        return "MetricBanner"

    if prev_component == "HighlighterText":
        return "GlassCard"
    return "HighlighterText"


def build_beat_props(
    component: str,
    text: str,
    index: int,
    total_beats: int,
    step_counter: int,
    beat_start_sec: float,
    beat_dur_sec: float,
    words: list[dict[str, Any]],
    glossary_rules: list[tuple[re.Pattern[str], str]],
    director: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], str, bool, str]:
    """
    Seçilen bileşene `TimelineRenderer.tsx` ile %100 uyumlu props sözlüğü,
    SFX, blurBackground bayrağı ve sahne geçiş karakterini (`transition`) üretir.
    """
    cfg = director or DEFAULT_DIRECTOR_CONFIG
    default_transition = str(cfg["transitions"].get("defaultType", "fade-slide"))
    anim_offset_sec = float(cfg["timing"].get("animationStartOffsetSec", 0.15))
    lower = tr_lower(text)

    if component == "MemoryBarSim":
        mode = (
            "fragmentation"
            if any(k in lower for k in ("parçalan", "fragmentation", "heap"))
            and "arena" not in lower
            and "hunk" not in lower
            else "arena"
            if any(k in lower for k in ("sıfırla", "pointer", "offset"))
            and "malloc" not in lower
            else "comparison"
        )
        return (
            {
                "eyebrow": f"BELLEK SİMÜLASYONU · SAHNE {index + 1:02d}",
                "title": "Doğrusal Arena vs Heap Parçalanması",
                "badge": "O(1) ARENA",
                "mode": mode,
                "resetAtSec": round(beat_dur_sec * 0.72, 2),
                "caption": text,
            },
            "tick",
            False,
            default_transition,
        )

    if component == "RayCastConeSim":
        return (
            {
                "eyebrow": f"GÖRÜNÜRLÜK SİMÜLASYONU · SAHNE {index + 1:02d}",
                "title": "Gerçek Zamanlı FOV Işınları ve BSP / PVS",
                "badge": "BSP · PVS",
                "fovDeg": 68,
                "rayCount": 26,
                "showBspTree": True,
                "caption": text,
            },
            "tick",
            False,
            default_transition,
        )

    if component == "ReferenceList":
        return (
            {
                "eyebrow": "KAYNAKÇA & REFERANSLAR",
                "title": "Teknik Kaynaklar ve Kod Depoları",
                "badge": "SOURCES",
                "items": [
                    {
                        "title": "Kaynak Dokümantasyon ve Mimari Notlar",
                        "source": text[:72],
                        "tag": "DOCS",
                        "highlighted": True,
                    },
                    {
                        "title": "Örnek Kod ve Proje Deposu",
                        "source": "Açık kaynak referans implementasyon",
                        "url": "github.com/org/repo",
                        "tag": "GITHUB",
                    },
                ],
                "footerNote": "Tüm kaynak bağlantıları video açıklamasında yer alır.",
            },
            "pop",
            True,
            default_transition,
        )

    if component == "TerminalTrace":
        is_conflict = any(k in lower for k in ("409", "çakış", "hata", "conflict", "engelle"))
        return (
            {
                "title": "zsh — localhost:8080",
                "prompt": "mac@api ~ %",
                "command": "curl -i -X POST http://localhost:8080/api/v1/resource",
                "statusCode": 409 if is_conflict else 200,
                "statusText": "Conflict" if is_conflict else "OK",
                "latency": "9 ms",
                "responseAtSec": round(min(1.3, beat_dur_sec * 0.34), 2),
                "highlightResponseLines": [2, 3],
                "responseBody": (
                    '{\n  "status": 409,\n  "code": "CONFLICT",\n  "mesaj": "' + text[:58] + '"\n}'
                    if is_conflict
                    else '{\n  "status": 200,\n  "sonuc": "OK",\n  "detay": "' + text[:58] + '"\n}'
                ),
                "caption": text,
            },
            "tick",
            False,
            "slideLeft",
        )

    if component == "CodeWindow":
        lang = "java" if "java" in lower or "transactional" in lower else "bash" if any(k in lower for k in ("bash", "komut")) else "sql"
        title = "Service.java" if lang == "java" else "terminal — zsh" if lang == "bash" else "query.sql"
        code = (
            f"-- {text}\nSELECT *\nFROM kayitlar\nWHERE durum = 'AKTIF';"
            if lang == "sql"
            else f"# {text}\nnpm run build"
            if lang == "bash"
            else f"// {text}\n@Transactional\npublic void execute() {{\n  // ...\n}}"
        )
        return (
            {
                "language": lang,
                "title": title,
                "code": code,
                "highlightLines": [2, 3],
                "caption": text,
            },
            "tick",
            False,
            "slideLeft",
        )

    if component == "SplitStage":
        return (
            {
                "eyebrow": f"ANALİZ · SAHNE {index + 1:02d}",
                "title": "Teknik Etki ve Ölçüm",
                "subtitle": text,
                "metric": {
                    "before": "420 ms",
                    "value": "8 ms",
                    "delta": "-98%",
                    "label": "PERFORMANS KAZANIMI",
                },
                "points": [
                    {
                        "title": "Ölçülebilir İyileşme",
                        "detail": text,
                        "tag": "BENCHMARK",
                        "highlighted": True,
                    }
                ],
                "visual": {
                    "type": "code",
                    "language": "sql",
                    "title": "explain.sql",
                    "code": "EXPLAIN ANALYZE\nSELECT 1 FROM tablo\nWHERE kosul = 1\nLIMIT 1;",
                    "highlightLines": [2, 3],
                },
            },
            "whoosh",
            False,
            "depthZoom",
        )

    if component == "ComparisonCard":
        return (
            {
                "eyebrow": f"KARŞILAŞTIRMA · SAHNE {index + 1:02d}",
                "title": "Yanlış Yaklaşım vs Doğru Yöntem",
                "leftTitle": "Eski / Hatalı Yaklaşım",
                "leftBadge": "HATALI",
                "leftItems": [
                    "Kontrolsüz ve tutarsız uygulama",
                    "Beklenmeyen kalite kaybı",
                ],
                "rightTitle": "Önerilen Doğru Yaklaşım",
                "rightBadge": "DOĞRU",
                "rightItems": [
                    text,
                    "Ölçülebilir ve tekrarlanabilir sonuç",
                ],
            },
            "pop",
            False,
            default_transition,
        )

    if component == "MediaWindow":
        return (
            {
                "src": "schema_preview.png",
                "title": f"ekran-{index + 1:02d}.png",
                "badge": "ÖRNEK GÖRSEL",
                "zoomPan": True,
                "caption": text,
            },
            "whoosh",
            True,
            default_transition,
        )

    if component == "StepCard":
        phrases = [p.strip() for p in re.split(r"[,.;]", text) if len(p.strip()) >= 6]
        if len(phrases) < 2:
            phrases = [text, "Kontrollü ilerleme", "Temiz kapanış"]
        steps = [
            {
                "title": f"{i + 1}. {p[:54]}",
                "detail": p if len(p) > 54 else "Zaman çizelgesine göre düzenleyebilirsiniz.",
            }
            for i, p in enumerate(phrases[:3])
        ]
        return (
            {
                "eyebrow": "UYGULAMA ADIMLARI",
                "title": "Adım Adım Akış",
                "activeStepIndex": min(step_counter, len(steps) - 1),
                "steps": steps,
            },
            "tick",
            False,
            default_transition,
        )

    if component == "NodeFlow":
        clauses = [c.strip() for c in re.split(r"\b(?:ve|ile|->)\b|,", text) if len(c.strip()) >= 5]
        node_labels = [c[:28] for c in clauses[:3]]
        while len(node_labels) < 2:
            node_labels.append("Sonuç" if len(node_labels) == 1 else "Girdi")
        nodes = [
            {
                "badge": f"{i + 1:02d}",
                "label": lbl,
                "highlighted": i == len(node_labels) - 1,
            }
            for i, lbl in enumerate(node_labels)
        ]
        return (
            {
                "eyebrow": f"AKIŞ · SAHNE {index + 1:02d}",
                "title": "Süreç Bağlantısı",
                "nodes": nodes,
                "caption": text,
            },
            "pop",
            False,
            "slideLeft",
        )

    if component == "MetricBanner":
        metric = extract_metric(text) or (f"{index + 1:02d}", "ANA KURAL")
        return (
            {
                "frameless": True,
                "badge": f"BÖLÜM {index + 1:02d}",
                "value": metric[0],
                "label": metric[1],
                "subtext": text,
            },
            "thud",
            False,
            "depthZoom",
        )

    if component == "GlassCard":
        short_words = text.split()
        short_title = " ".join(short_words[:4]).rstrip(".,;:") if short_words else f"Odak {index + 1}"
        return (
            {
                "subtitle": f"ODAK KARTI · {index + 1:02d}",
                "title": short_title,
                "badge": f"SAHNE {index + 1:02d}",
                "body": text,
                "items": [
                    {
                        "label": "Kilit Çıkarım",
                        "value": "Konuşma akışına senkronlandı",
                        "tag": "TASLAK",
                        "highlighted": True,
                    }
                ],
            },
            "pop",
            True,
            default_transition,
        )

    # Varsayılan: HighlighterText (kelime zaman damgalı `highlightAtSecs` + giriş/kapanışta frameless)
    highlights = extract_key_phrases(text)
    highlight_secs = resolve_highlight_timestamps(
        highlights,
        beat_start_sec,
        beat_dur_sec,
        words,
        glossary_rules,
        anim_offset_sec=anim_offset_sec,
    )
    use_frameless = index == 0 or index == total_beats - 1
    return (
        {
            "frameless": use_frameless,
            "eyebrow": f"VURGU · SAHNE {index + 1:02d}",
            "text": text,
            "highlights": highlights,
            "highlightAtSecs": highlight_secs,
        },
        "whoosh" if index == 0 else "pop",
        False,
        "focusBlur" if use_frameless else default_transition,
    )


def build_timeline_draft(
    transcript: dict[str, Any],
    glossary_rules: list[tuple[re.Pattern[str], str]],
    fps: int = 30,
    director: dict[str, Any] | None = None,
) -> dict[str, Any]:
    cfg = director or load_director_config()
    total_duration = round(float(transcript.get("durationSec") or 0.0), 3)
    segments = transcript.get("segments") or []
    source_audio = transcript.get("source") or ""
    audio_name = Path(source_audio).name if source_audio else None

    blocks = build_timed_blocks(segments, total_duration, director=cfg)

    beats: list[dict[str, Any]] = []
    prev_component: str | None = None
    step_counter = 0

    for idx, blk in enumerate(blocks):
        cleaned_text = apply_glossary(blk["text"], glossary_rules)
        beat_start = round(float(blk["startSec"]), 3)
        beat_end = round(float(blk["endSec"]), 3)
        beat_dur = beat_end - beat_start

        comp = classify_component(cleaned_text, idx, prev_component)
        props, sfx, blur_bg, transition = build_beat_props(
            comp,
            cleaned_text,
            idx,
            len(blocks),
            step_counter,
            beat_start,
            beat_dur,
            blk.get("words") or [],
            glossary_rules,
            director=cfg,
        )
        if comp == "StepCard":
            step_counter += 1
        else:
            step_counter = 0

        bg = "radialGlow" if comp == "MetricBanner" else ("obsidianGrid" if idx % 2 == 0 else "dotMatrix")
        beat_entry: dict[str, Any] = {
            "id": f"draft-{idx + 1:02d}-{comp.lower()}",
            "startSec": beat_start,
            "endSec": beat_end,
            "component": comp,
            "background": bg,
            "transition": transition,
            "sfx": sfx,
            "sfxVolume": 0.16 if sfx == "thud" else (0.14 if sfx == "whoosh" else 0.13),
            "props": props,
        }
        if blur_bg:
            beat_entry["blurBackground"] = True

        beats.append(beat_entry)
        prev_component = comp

    return {
        "meta": {
            "title": "Otomatik Sahne Taslağı (Draft v3.0)",
            "fps": fps,
            "width": 1920,
            "height": 1080,
            "durationSec": total_duration,
        },
        "theme": cfg["activeTheme"],
        "audio": audio_name,
        "audioVolume": 1,
        "bgMusic": "audio/ambient.mp3",
        "bgMusicVolume": 0.06,
        "showHud": True,
        "background": "obsidianGrid",
        "beats": beats,
    }


def write_split_chapters(
    draft: dict[str, Any],
    chapter_len_sec: float,
    chapters_dir: Path,
) -> list[Path]:
    """Uzun taslakları M1 dostu ~60 saniyelik bağımsız bölüm JSON dosyalarına böler."""
    chapters_dir.mkdir(parents=True, exist_ok=True)
    beats = draft["beats"]
    groups: list[list[dict[str, Any]]] = []
    cur_group: list[dict[str, Any]] = []
    group_start = 0.0

    for beat in beats:
        if cur_group and (beat["endSec"] - group_start) > chapter_len_sec:
            groups.append(cur_group)
            cur_group = [beat]
            group_start = beat["startSec"]
        else:
            if not cur_group:
                group_start = beat["startSec"]
            cur_group.append(beat)
    if cur_group:
        groups.append(cur_group)

    written: list[Path] = []
    for ch_idx, ch_beats in enumerate(groups, start=1):
        origin = ch_beats[0]["startSec"]
        end_abs = ch_beats[-1]["endSec"]
        ch_dur = round(end_abs - origin, 3)

        rel_beats = []
        for b in ch_beats:
            nb = dict(b)
            nb["startSec"] = round(b["startSec"] - origin, 3)
            nb["endSec"] = round(b["endSec"] - origin, 3)
            nb["chapterLabel"] = f"BÖLÜM {ch_idx:02d}"
            rel_beats.append(nb)

        ch_spec: dict[str, Any] = {
            "meta": {
                "title": f"{draft['meta']['title']} · Bölüm {ch_idx:02d}",
                "fps": draft["meta"]["fps"],
                "width": draft["meta"]["width"],
                "height": draft["meta"]["height"],
                "durationSec": ch_dur,
            },
            "theme": draft.get("theme", DEFAULT_DIRECTOR_CONFIG["activeTheme"]),
            "audio": draft["audio"],
            "audioVolume": draft["audioVolume"],
            "bgMusic": draft["bgMusic"],
            "bgMusicVolume": draft["bgMusicVolume"],
            "showHud": True,
            "background": draft["background"],
            "beats": rel_beats,
        }
        if origin > 0:
            ch_spec["audioOffsetSec"] = round(origin, 3)
        out_file = chapters_dir / f"{ch_idx:02d}_bolum.json"
        out_file.write_text(json.dumps(ch_spec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        written.append(out_file)

    return written


def write_script_chapters(
    transcript: dict[str, Any],
    glossary_rules: list[tuple[re.Pattern[str], str]],
    chapters_dir: Path,
    fps: int = 30,
    director: dict[str, Any] | None = None,
) -> list[Path]:
    """
    `generate_voice.py` tarafından `transcript.json` içine yazılan `chapters` sınırlarına göre
    her `## Bölüm` başlığını kendi bağımsız bölüm JSON dosyasına (audioOffsetSec ile) böler.
    """
    cfg = director or load_director_config()
    script_chapters = transcript.get("chapters") or []
    if not script_chapters:
        return []

    chapters_dir.mkdir(parents=True, exist_ok=True)
    all_segments = transcript.get("segments") or []
    source_audio = transcript.get("source") or ""
    written: list[Path] = []

    for ch in script_chapters:
        ch_idx = int(ch.get("index") or (len(written) + 1))
        ch_title = str(ch.get("title") or f"Bölüm {ch_idx:02d}")
        ch_slug = str(ch.get("slug") or f"bolum_{ch_idx:02d}")
        ch_start = round(float(ch.get("startSec") or 0.0), 3)
        ch_end = round(float(ch.get("endSec") or ch_start), 3)
        ch_dur = round(max(1.0, ch_end - ch_start), 3)

        # Bu bölüme ait cümle segmentlerini yerel 0.0 saniyesine kaydır
        rel_segments: list[dict[str, Any]] = []
        for seg in all_segments:
            s0 = float(seg.get("startSec", 0.0))
            if s0 >= ch_start - 0.05 and s0 < ch_end - 0.02:
                rel_words = []
                for w in seg.get("words") or []:
                    rel_words.append(
                        {
                            "word": w["word"],
                            "startSec": round(max(0.0, float(w["startSec"]) - ch_start), 3),
                            "endSec": round(min(ch_dur, max(0.0, float(w["endSec"]) - ch_start)), 3),
                            "probability": w.get("probability", 1.0),
                        }
                    )
                rel_segments.append(
                    {
                        "id": len(rel_segments),
                        "startSec": round(max(0.0, s0 - ch_start), 3),
                        "endSec": round(min(ch_dur, max(0.0, float(seg.get("endSec", s0)) - ch_start)), 3),
                        "text": seg["text"],
                        "words": rel_words,
                    }
                )

        sub_transcript = {
            "source": source_audio,
            "language": transcript.get("language", "tr"),
            "durationSec": ch_dur,
            "segments": rel_segments,
        }
        ch_spec = build_timeline_draft(sub_transcript, glossary_rules, fps=fps, director=cfg)
        ch_spec["meta"]["title"] = ch_title
        if ch_start > 0:
            ch_spec["audioOffsetSec"] = ch_start

        short_label = f"{ch_idx:02d} · {ch_title.upper()[:28]}"
        for b_idx, beat in enumerate(ch_spec["beats"], start=1):
            beat["id"] = f"ch{ch_idx:02d}-{b_idx:02d}-{beat['component'].lower()}"
            beat["chapterLabel"] = short_label

        out_file = chapters_dir / f"{ch_idx:02d}_{ch_slug}.json"
        out_file.write_text(
            json.dumps(ch_spec, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        written.append(out_file)

    return written


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="transcript.json + glossary.json + director.json ile timeline_draft.json üretir."
    )
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Girdi transcript.json yolu")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Çıktı timeline_draft.json yolu")
    parser.add_argument("--glossary", default=str(DEFAULT_GLOSSARY), help="Terim düzeltme sözlüğü JSON yolu")
    parser.add_argument("--director", default=str(DEFAULT_DIRECTOR), help="Merkezi director.json konfigürasyon yolu")
    parser.add_argument("--theme", default="", help="İsteğe bağlı tema profili geçersiz kılması (obsidianAmber|crtPhosphor|blueprintCyan|editorialPaper)")
    parser.add_argument("--fps", type=int, default=30, help="Varsayılan FPS (M1 için 30)")
    parser.add_argument(
        "--split-chapters",
        type=float,
        default=0.0,
        help="Belirtilirse (ör. 60) taslağı ayrıca o uzunlukta bölüm JSON'larına böler",
    )
    parser.add_argument(
        "--split-by-script",
        action="store_true",
        help="transcript.json içindeki script.md bölüm sınırlarına göre bölüm JSON'ları üretir",
    )
    parser.add_argument(
        "--chapters-dir",
        default=str(ROOT_DIR / "src" / "data" / "chapters_draft"),
        help="--split-chapters / --split-by-script çıktı klasörü",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    in_path = Path(args.input).resolve()
    out_path = Path(args.output).resolve()
    glossary_path = Path(args.glossary).resolve()
    director_path = Path(args.director).resolve()

    if not in_path.is_file():
        print(f"[HATA] Transkript dosyası bulunamadı: {in_path}", file=sys.stderr)
        return 1

    director = load_director_config(director_path)
    if args.theme.strip():
        director["activeTheme"] = args.theme.strip()

    glossary_rules = load_glossary(glossary_path)
    transcript = json.loads(in_path.read_text(encoding="utf-8"))
    draft = build_timeline_draft(transcript, glossary_rules, fps=args.fps, director=director)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(draft, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    beats = draft["beats"]
    min_sec = float(director["timing"]["minSceneDurationSec"])
    max_sec = float(director["timing"]["maxSceneDurationSec"])
    over_max = [b for b in beats if (b["endSec"] - b["startSec"]) > max_sec + 1e-6]
    under_min = [b for b in beats if (b["endSec"] - b["startSec"]) < min_sec - 1e-6]
    print(f"[plan] Yönetmen: {director_path.name} (tema={director['activeTheme']}, ritim={min_sec}–{max_sec}sn, geçiş={director['transitions']['defaultType']})")
    print(f"[plan] Sözlük: {len(glossary_rules)} terim kuralı ({glossary_path.name})")
    print(f"[plan] Kaynak: {in_path.name} ({draft['meta']['durationSec']} sn @ {args.fps} fps)")
    print(f"[plan] Sahne sayısı: {len(beats)} | >{max_sec}sn ihlali: {len(over_max)} | <{min_sec}sn: {len(under_min)}")
    for b in beats:
        dur = b["endSec"] - b["startSec"]
        extra = ""
        if b["component"] == "HighlighterText" and b["props"].get("highlightAtSecs"):
            extra = f" sync={b['props']['highlightAtSecs']}"
        print(
            f"       - {b['id']:28s} {b['startSec']:5.2f}s–{b['endSec']:5.2f}s "
            f"({dur:4.2f}s) -> {b['component']:15s} [{b['sfx']}]{extra}"
        )
    print(f"[plan] Taslak kaydedildi: {out_path}")

    chapters_dir = Path(args.chapters_dir).resolve()
    if args.split_by_script and transcript.get("chapters"):
        files = write_script_chapters(transcript, glossary_rules, chapters_dir, fps=args.fps, director=director)
        print(f"[plan] {len(files)} betik bölümü üretildi -> {args.chapters_dir}")
        for f in files:
            print(f"       - {f.name}")
    elif args.split_chapters > 0:
        files = write_split_chapters(draft, args.split_chapters, chapters_dir)
        print(f"[plan] {len(files)} bölüm dosyası üretildi -> {args.chapters_dir}")
        for f in files:
            print(f"       - {f.name}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

import { VIDEO_CONFIG } from "../theme";
import type { AudioTrackSegment, TimelineBeat, TimelineSpec } from "./types";

interface WebpackRequireContext {
  keys(): string[];
  <T>(id: string): T;
}

declare const require: {
  context(
    directory: string,
    useSubdirectories?: boolean,
    regExp?: RegExp
  ): WebpackRequireContext;
};

export interface ChapterEntry {
  /** Remotion Composition için güvenli benzersiz kimlik (ör. "Chapter-01-v2-showcase") */
  id: string;
  /** Orijinal dosya adı (ör. "01_v2_showcase.json") */
  filename: string;
  timeline: TimelineSpec;
}

function toCompositionId(filename: string): string {
  const base = filename
    .replace(/^\.\//, "")
    .replace(/\.json$/i, "")
    .replace(/[^a-zA-Z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `Chapter-${base || "untitled"}`;
}

function getChapterDurationSec(spec: TimelineSpec): number {
  const maxBeatEnd = spec.beats.reduce(
    (max, beat) => Math.max(max, beat.endSec),
    0
  );
  return Math.max(spec.meta.durationSec ?? 0, maxBeatEnd, 0);
}

/**
 * `src/data/chapters/*.json` dosyalarını alfabetik sırayla otomatik yükler.
 * Webpack `require.context` sayesinde yeni bir bölüm JSON'u eklendiğinde motor koduna
 * dokunmaya gerek kalmaz.
 */
export function loadChapters(): ChapterEntry[] {
  try {
    const ctx = require.context("../data/chapters", false, /\.json$/);
    const sortedKeys = ctx.keys().sort((a, b) => a.localeCompare(b));

    return sortedKeys.map((key) => {
      const mod = ctx<TimelineSpec | { default: TimelineSpec }>(key);
      const timeline =
        "default" in mod ? (mod.default as TimelineSpec) : (mod as TimelineSpec);
      const filename = key.replace(/^\.\//, "");
      return {
        id: toCompositionId(filename),
        filename,
        timeline,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Alfabetik sıralı tüm bölümleri tek bir birleşik `TimelineSpec` zaman çizelgesinde toplar.
 * - Her bölüm `0` saniyeden başlıyorsa (göreli zamanlama), önceki bölümlerin toplam süresi kadar
 *   otomatik ileri kaydırılır.
 * - Bölüm zaten mutlak saniyelerle yazılmışsa (ilk beat >= birikimli süre), zamanları korunur.
 */
export function mergeChapters(chapters: ChapterEntry[]): TimelineSpec | null {
  if (chapters.length === 0) {
    return null;
  }

  const first = chapters[0].timeline;
  const mergedBeats: TimelineBeat[] = [];
  const audioSegments: AudioTrackSegment[] = [];

  let offsetSec = 0;
  let sharedAudio: string | null = null;
  let sharedAudioVolume: number | undefined;
  let sharedBgMusic: string | null | undefined = first.bgMusic;
  let sharedBgMusicVolume: number | undefined = first.bgMusicVolume;

  // Tüm bölümler aynı ana ses dosyasına işaret ediyorsa tek ses parçası olarak çal
  const uniqueAudioFiles = new Set(
    chapters
      .map((c) => c.timeline.audio?.trim())
      .filter((a): a is string => Boolean(a))
  );
  const usesSingleMasterAudio =
    uniqueAudioFiles.size === 1 && chapters.length > 1;

  if (usesSingleMasterAudio) {
    sharedAudio = Array.from(uniqueAudioFiles)[0];
    sharedAudioVolume = first.audioVolume;
  }

  for (const chapter of chapters) {
    const spec = chapter.timeline;
    const chapterPrefix = chapter.filename.replace(/\.json$/i, "");
    const firstBeatStart =
      spec.beats.length > 0
        ? Math.min(...spec.beats.map((b) => b.startSec))
        : 0;

    // İlk bölümden sonra beat'ler 0'dan başlıyorsa göreli ofset uygula
    const isRelative = offsetSec > 0 && firstBeatStart < offsetSec - 0.05;
    const shift = isRelative ? offsetSec : 0;

    const chapterDur = getChapterDurationSec(spec);

    if (!usesSingleMasterAudio && spec.audio && spec.audio.trim().length > 0) {
      audioSegments.push({
        src: spec.audio.trim(),
        startSec: shift,
        durationSec: chapterDur > 0 ? chapterDur : undefined,
        volume: spec.audioVolume ?? 1,
      });
    }

    if (!sharedBgMusic && spec.bgMusic) {
      sharedBgMusic = spec.bgMusic;
      sharedBgMusicVolume = spec.bgMusicVolume;
    }

    for (const beat of spec.beats) {
      mergedBeats.push({
        ...beat,
        id: `${chapterPrefix}__${beat.id}`,
        startSec: Number((beat.startSec + shift).toFixed(3)),
        endSec: Number((beat.endSec + shift).toFixed(3)),
      });
    }

    const chapterAbsoluteEnd = isRelative
      ? offsetSec + chapterDur
      : Math.max(offsetSec, chapterDur);
    offsetSec = Number(chapterAbsoluteEnd.toFixed(3));
  }

  const sharedTheme = chapters.find((c) => c.timeline.theme)?.timeline.theme;

  return {
    meta: {
      title:
        chapters.length === 1
          ? first.meta.title
          : `${first.meta.title} (${chapters.length} Bölüm)`,
      fps: first.meta.fps ?? VIDEO_CONFIG.fps,
      width: first.meta.width ?? VIDEO_CONFIG.width,
      height: first.meta.height ?? VIDEO_CONFIG.height,
      durationSec: offsetSec,
    },
    audio: usesSingleMasterAudio ? sharedAudio : null,
    audioVolume: sharedAudioVolume ?? 1,
    audioSegments: audioSegments.length > 0 ? audioSegments : undefined,
    bgMusic: sharedBgMusic ?? null,
    bgMusicVolume: sharedBgMusicVolume ?? 0.06,
    showHud: first.showHud,
    theme: sharedTheme,
    background: first.background ?? "obsidianGrid",
    beats: mergedBeats,
  };
}

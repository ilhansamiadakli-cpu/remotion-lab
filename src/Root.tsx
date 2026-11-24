import React from "react";
import { Composition } from "remotion";
import {
  DEFAULT_TIMELINE,
  TimelineRenderer,
  getTimelineDurationInFrames,
} from "./engine/TimelineRenderer";
import { loadChapters, mergeChapters } from "./engine/chapters";
import { DemoScene } from "./scenes/DemoScene";
import { VIDEO_CONFIG } from "./theme";

/**
 * RemotionRoot:
 * 1. `MainVideo`: Tekil `src/data/timeline.json` dosyasını 30 FPS varsayılanıyla sunar.
 * 2. `ChaptersVideo`: `src/data/chapters/*.json` dosyalarını alfabetik sırayla birleştirir.
 * 3. `Chapter-*`: M1/düşük RAM için her bölümü tek başına render alabilmeyi sağlar.
 */
export const RemotionRoot: React.FC = () => {
  const mainDuration = getTimelineDurationInFrames(DEFAULT_TIMELINE);
  const mainFps = DEFAULT_TIMELINE.meta.fps ?? VIDEO_CONFIG.fps;
  const mainWidth = DEFAULT_TIMELINE.meta.width ?? VIDEO_CONFIG.width;
  const mainHeight = DEFAULT_TIMELINE.meta.height ?? VIDEO_CONFIG.height;

  const chapters = loadChapters();
  const mergedChapters = mergeChapters(chapters);

  return (
    <>
      {/* Tekil timeline.json kompozisyonu */}
      <Composition
        id="MainVideo"
        component={TimelineRenderer}
        durationInFrames={mainDuration}
        fps={mainFps}
        width={mainWidth}
        height={mainHeight}
      />

      {/* Tüm chapters/*.json bölümlerinin alfabetik birleşimi */}
      {mergedChapters && (
        <Composition
          id="ChaptersVideo"
          component={TimelineRenderer}
          defaultProps={{ timeline: mergedChapters, source: "chapters" as const }}
          durationInFrames={getTimelineDurationInFrames(mergedChapters)}
          fps={mergedChapters.meta.fps ?? VIDEO_CONFIG.fps}
          width={mergedChapters.meta.width ?? VIDEO_CONFIG.width}
          height={mergedChapters.meta.height ?? VIDEO_CONFIG.height}
        />
      )}

      {/* Bölüm bazlı bağımsız render kompozisyonları (M1 MacBook Air dostu) */}
      {chapters.map((chapter) => (
        <Composition
          key={chapter.id}
          id={chapter.id}
          component={TimelineRenderer}
          defaultProps={{ timeline: chapter.timeline }}
          durationInFrames={getTimelineDurationInFrames(chapter.timeline)}
          fps={chapter.timeline.meta.fps ?? VIDEO_CONFIG.fps}
          width={chapter.timeline.meta.width ?? VIDEO_CONFIG.width}
          height={chapter.timeline.meta.height ?? VIDEO_CONFIG.height}
        />
      ))}

      {/* İlk aşamadaki manuel sahne örneği referans olarak korunur */}
      <Composition
        id="DemoScene"
        component={DemoScene}
        durationInFrames={600}
        fps={60}
        width={VIDEO_CONFIG.width}
        height={VIDEO_CONFIG.height}
      />
    </>
  );
};

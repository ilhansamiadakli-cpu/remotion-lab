import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BACKGROUNDS, type BackgroundKey } from "../backgrounds";
import { COMPONENTS } from "../components";
import { DIRECTOR_CONFIG } from "../config/director";
import rawTimeline from "../data/timeline.json";
import {
  COLORS,
  FONTS,
  MOTION,
  ThemeProvider,
  VIDEO_CONFIG,
  resolveTheme,
  secToFrames,
  themeToCssVars,
  useActiveTheme,
} from "../theme";
import { loadChapters, mergeChapters } from "./chapters";
import type { SceneTransition, SfxKey, TimelineBeat, TimelineSpec } from "./types";

const DEFAULT_TIMELINE = rawTimeline as TimelineSpec;

/**
 * `timeline.json` veya birleşik `chapters/*.json` verisinden toplam kompozisyon süresini
 * kare cinsinden hesaplar. Süre değiştiğinde `Root.tsx` dosyasına dokunmak gerekmez.
 */
export function getTimelineDurationInFrames(
  timeline: TimelineSpec = DEFAULT_TIMELINE
): number {
  const fps = timeline.meta.fps ?? VIDEO_CONFIG.fps;
  const maxBeatEndSec = timeline.beats.reduce(
    (max, beat) => Math.max(max, beat.endSec),
    0
  );
  const totalSec = Math.max(timeline.meta.durationSec ?? 0, maxBeatEndSec, 1);
  return Math.round(totalSec * fps);
}

/**
 * `public/audio/` içindeki yolları esnek biçimde normalize eder.
 * Kullanıcı hem "kayit.mp3" hem "audio/kayit.mp3" yazabilir.
 */
function resolveAudioPath(audioFile: string): string {
  const cleaned = audioFile.replace(/^\/+/, "");
  return cleaned.startsWith("audio/") ? cleaned : `audio/${cleaned}`;
}

function resolveSfxPath(sfx: SfxKey): string | null {
  if (sfx === "none") return null;
  return `sfx/${sfx}.wav`;
}

function beatRequiresBgBlur(beat: TimelineBeat | undefined): boolean {
  if (!beat) return false;
  if (typeof beat.blurBackground === "boolean") {
    return beat.blurBackground;
  }
  if (
    beat.component === "GlassCard" ||
    beat.component === "MediaWindow" ||
    beat.component === "ReferenceList"
  ) {
    return true;
  }
  if (beat.component === "SplitStage" && beat.props.visual.type === "media") {
    return true;
  }
  return false;
}

/**
 * Aktif tema profiline duyarlı Monokrom Film Greni Katmanı (M1 dostu — statik SVG doku + hafif kaydırma).
 * Koyu gradyanlarda YouTube H.264 renk şeritlenmesini (banding) önler ve sinematik doku kazandırır.
 */
const FilmGrainOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const theme = useActiveTheme();

  if (theme.filmGrainOpacity <= 0) {
    return null;
  }

  // Her 2 karede bir doku konumunu deterministik kaydırarak doğal 35mm gren hareketi üret
  const step = Math.floor(frame / 2);
  const offsetX = ((step * 37) % 64) - 32;
  const offsetY = ((step * 53) % 64) - 32;

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        zIndex: 900,
        opacity: theme.filmGrainOpacity,
        mixBlendMode: theme.isLight ? "multiply" : "overlay",
        overflow: "hidden",
      }}
    >
      <svg
        width="112%"
        height="112%"
        style={{
          position: "absolute",
          top: "-6%",
          left: "-6%",
          transform: `translate3d(${offsetX}px, ${offsetY}px, 0)`,
        }}
      >
        <filter id="obsidian-film-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.78"
            numOctaves={3}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#obsidian-film-grain)" />
      </svg>
    </AbsoluteFill>
  );
};

/**
 * CRT Fosfor Tarama Çizgisi (Scanline) Katmanı:
 * Yalnızca `scanlineOpacity > 0` olan temalarda (ör. `crtPhosphor`) otomatik devreye girer.
 */
const ScanlineOverlay: React.FC = () => {
  const theme = useActiveTheme();

  if (theme.scanlineOpacity <= 0) {
    return null;
  }

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        zIndex: 895,
        opacity: theme.scanlineOpacity,
        backgroundImage:
          "repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0, 0, 0, 0.52) 2px, rgba(0, 0, 0, 0.52) 4px)",
      }}
    >
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 58%, rgba(0, 0, 0, 0.42) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Sürekli Global Arka Plan Katmanı:
 * `<Sequence>` dışında çalıştığı için arka plan ızgarası ve nokta matrisi
 * beat geçişlerinde asla (0, 0) noktasına geri zıplamaz; kesintisiz akarken
 * arka plan türleri ve alan derinliği (blur) yumuşakça birbirine erir.
 */
const PersistentBackgroundLayer: React.FC<{
  beats: TimelineBeat[];
  defaultBackground: BackgroundKey;
}> = ({ beats, defaultBackground }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (beats.length === 0) {
    const DefaultBg = BACKGROUNDS[defaultBackground] ?? BACKGROUNDS.obsidianGrid;
    return <DefaultBg />;
  }

  let activeIdx = beats.length - 1;
  for (let i = 0; i < beats.length; i++) {
    const startFrame = secToFrames(beats[i].startSec, fps);
    const endFrame = secToFrames(beats[i].endSec, fps);
    if (frame >= startFrame && frame < endFrame) {
      activeIdx = i;
      break;
    }
    if (frame < startFrame) {
      activeIdx = Math.max(0, i - 1);
      break;
    }
  }

  const activeBeat = beats[activeIdx];
  const prevBeat = activeIdx > 0 ? beats[activeIdx - 1] : undefined;

  const activeStartFrame = secToFrames(activeBeat.startSec, fps);
  const localBeatFrame = Math.max(0, frame - activeStartFrame);

  const transitionProgress = spring({
    frame: localBeatFrame,
    fps,
    config: MOTION.editorial,
  });

  const activeBgKey: BackgroundKey = activeBeat.background ?? defaultBackground;
  const prevBgKey: BackgroundKey | undefined = prevBeat
    ? (prevBeat.background ?? defaultBackground)
    : undefined;

  const activeBlurTarget = beatRequiresBgBlur(activeBeat) ? 6 : 0;
  const prevBlurTarget = beatRequiresBgBlur(prevBeat) ? 6 : 0;

  const activeDimTarget = activeBlurTarget > 0 ? 0.68 : 1;
  const prevDimTarget = prevBlurTarget > 0 ? 0.68 : 1;

  const blurPx = interpolate(
    transitionProgress,
    [0, 1],
    [prevBlurTarget, activeBlurTarget]
  );
  const dimOpacity = interpolate(
    transitionProgress,
    [0, 1],
    [prevDimTarget, activeDimTarget]
  );

  // Sahne ilerledikçe arka plana uygulanan hafif sürekli paralaks kayması
  const parallaxX = -(activeIdx * 18) - transitionProgress * 18;
  const parallaxY = -((activeIdx % 3) * 8);

  const ActiveBg = BACKGROUNDS[activeBgKey] ?? BACKGROUNDS.obsidianGrid;
  const shouldCrossfade =
    Boolean(prevBgKey) && prevBgKey !== activeBgKey && transitionProgress < 0.995;
  const PrevBg =
    shouldCrossfade && prevBgKey ? BACKGROUNDS[prevBgKey] : null;

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      {PrevBg && (
        <PrevBg
          blurPx={blurPx}
          dimOpacity={dimOpacity}
          layerOpacity={Math.max(0, 1 - transitionProgress)}
          parallaxX={parallaxX}
          parallaxY={parallaxY}
        />
      )}
      <ActiveBg
        blurPx={blurPx}
        dimOpacity={dimOpacity}
        layerOpacity={shouldCrossfade ? transitionProgress : 1}
        parallaxX={parallaxX}
        parallaxY={parallaxY}
      />
    </AbsoluteFill>
  );
};

/**
 * Minimalist Mühendislik HUD'u:
 * - Sol üstte düşük kontrastlı bölüm/sahne izi (`01 / 11 · BAŞLIK`)
 * - En altta `2px` hassas sıcak kehribar ilerleme rayı
 * `MetricBanner` tam ekran vuruş sahnelerinde otomatik gizlenir.
 */
const EngineeringHUD: React.FC<{
  title: string;
  beats: TimelineBeat[];
}> = ({ title, beats }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const theme = useActiveTheme();

  if (beats.length === 0) return null;

  let activeIdx = beats.length - 1;
  for (let i = 0; i < beats.length; i++) {
    const startFrame = secToFrames(beats[i].startSec, fps);
    const endFrame = secToFrames(beats[i].endSec, fps);
    if (frame >= startFrame && frame < endFrame) {
      activeIdx = i;
      break;
    }
  }

  const activeBeat = beats[activeIdx];
  const hideForImpact = activeBeat.component === "MetricBanner";
  const progressPct = Math.min(
    100,
    Math.max(0, (frame / Math.max(1, durationInFrames - 1)) * 100)
  );
  const labelText = activeBeat.chapterLabel ?? title;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 800 }}>
      {/* Sol üst teknik bağlam izi */}
      {!hideForImpact && (
        <div
          style={{
            position: "absolute",
            top: 28,
            left: 36,
            display: "flex",
            alignItems: "center",
            gap: 10,
            opacity: theme.isLight ? 0.68 : 0.48,
            fontFamily: FONTS.mono,
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: COLORS.textSecondary,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              background: COLORS.accent,
            }}
          />
          <span style={{ color: COLORS.textPrimary, fontWeight: 600 }}>
            {String(activeIdx + 1).padStart(2, "0")} /{" "}
            {String(beats.length).padStart(2, "0")}
          </span>
          <span style={{ opacity: 0.45 }}>·</span>
          <span>{labelText}</span>
        </div>
      )}

      {/* Alt 2px aktif tema vurgu ilerleme çizgisi */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 2,
          background: theme.isLight
            ? "rgba(15, 23, 42, 0.08)"
            : "rgba(255, 255, 255, 0.05)",
        }}
      >
        <div
          style={{
            width: `${progressPct}%`,
            height: "100%",
            background: COLORS.accent,
            boxShadow: `0 0 10px ${COLORS.accentGlow}`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/**
 * Sahne Ritim Denetleyici (Yalnızca Geliştirme / Studio Önizleme Modu)
 * Herhangi bir beat `director.json` -> `timing.maxSceneDurationSec` sınırını aşarsa
 * sağ üst köşede geliştirici uyarısı gösterir.
 */
const PacingRuleWarning: React.FC<{ durationSec: number; maxSec: number }> = ({
  durationSec,
  maxSec,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        top: 26,
        right: 30,
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        borderRadius: 8,
        background: COLORS.warningBg,
        border: `1px solid ${COLORS.warningBorder}`,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        fontFamily: FONTS.mono,
        fontSize: 13,
        fontWeight: 600,
        color: COLORS.warningText,
        letterSpacing: "0.02em",
        boxShadow: "0 10px 24px rgba(0, 0, 0, 0.45)",
      }}
    >
      <span>[UYARI: &gt;{maxSec}sn sabit sahne]</span>
      <span style={{ opacity: 0.78 }}>{durationSec.toFixed(1)}sn</span>
    </div>
  );
};

/**
 * Tek bir sahneyi (beat) kendi yerel zaman ekseninde (Sequence içinde frame=0'dan başlayarak)
 * `src/config/director.json` içindeki geçiş tipi, yay parametreleri ve animasyon başlangıç
 * ofsetiyle işler.
 */
const BeatStage: React.FC<{
  beat: TimelineBeat;
  durationInFrames: number;
  isFirstBeat: boolean;
  isLastBeat: boolean;
}> = ({ beat, durationInFrames, isFirstBeat, isLastBeat }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { transitions, timing } = DIRECTOR_CONFIG;
  const transitionMode: SceneTransition = beat.transition ?? transitions.defaultType;

  const directorSpring = {
    damping: transitions.springDamping,
    stiffness: transitions.springStiffness,
    mass: 1,
  };
  const transitionDurationFrames = Math.max(4, Math.round(transitions.durationFrames));
  const animationOffsetFrames = Math.max(
    0,
    secToFrames(timing.animationStartOffsetSec, fps)
  );

  // Giriş geçiş yayı (`director.json` spring + durationFrames)
  const enterProgress = isFirstBeat
    ? 1
    : spring({
        frame,
        fps,
        durationInFrames: transitionDurationFrames,
        config: directorSpring,
      });

  // Sahne sonundaki çıkış zarfı (`director.json` durationFrames ile uyumlu)
  const exitLeadFrames = Math.min(
    Math.max(4, Math.floor(durationInFrames / 3)),
    Math.max(6, Math.round(transitionDurationFrames * 0.65))
  );
  const exitLocalFrame = Math.max(0, frame - (durationInFrames - exitLeadFrames));
  const exitProgress = isLastBeat
    ? 0
    : spring({
        frame: exitLocalFrame,
        fps,
        durationInFrames: exitLeadFrames,
        config: directorSpring,
      });

  let translateX = 0;
  let translateY = 0;
  let scale = 1;
  let blurPx = 0;
  let enterOpacity = 1;

  if (transitionMode === "fade-slide") {
    enterOpacity = isFirstBeat
      ? 1
      : interpolate(enterProgress, [0, 0.72, 1], [0, 1, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
    translateY =
      interpolate(enterProgress, [0, 1], [22, 0]) +
      interpolate(exitProgress, [0, 1], [0, -14]);
    scale = interpolate(exitProgress, [0, 1], [1, 0.99]);
  } else if (transitionMode === "slideLeft") {
    translateX =
      interpolate(enterProgress, [0, 1], [44, 0]) +
      interpolate(exitProgress, [0, 1], [0, -44]);
  } else if (transitionMode === "depthZoom") {
    scale =
      interpolate(enterProgress, [0, 1], [0.95, 1]) *
      interpolate(exitProgress, [0, 1], [1, 1.035]);
    blurPx = interpolate(exitProgress, [0, 1], [0, 3]);
  } else if (transitionMode === "focusBlur") {
    blurPx =
      interpolate(enterProgress, [0, 1], [4, 0]) +
      interpolate(exitProgress, [0, 1], [0, 4]);
  } else {
    // "editorial": minimal ağırlıklı yükseliş / çekilme
    translateY = interpolate(exitProgress, [0, 1], [0, -10]);
    scale = interpolate(exitProgress, [0, 1], [1, 0.988]);
  }

  const exitOpacity = interpolate(exitProgress, [0, 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const stageOpacity = enterOpacity * exitOpacity;

  const BeatComponent = COMPONENTS[beat.component] as React.ComponentType<
    Record<string, unknown>
  >;

  const rawBeatProps = beat.props as Record<string, unknown>;
  const componentProps: Record<string, unknown> = {
    ...rawBeatProps,
    beatDurationInFrames: durationInFrames,
  };
  // `director.json` -> `animationStartOffsetSec` değerini explicit `startFrame` belirtilmemiş
  // bileşen girişlerine uygula (HighlighterText'in kelime senkronlu highlightStart'ını koru)
  if (
    typeof rawBeatProps.startFrame !== "number" &&
    beat.component !== "HighlighterText" &&
    !isFirstBeat &&
    animationOffsetFrames > 0
  ) {
    componentProps.startFrame = animationOffsetFrames;
  }

  const beatDurationSec = beat.endSec - beat.startSec;
  const maxAllowedSec = timing.maxSceneDurationSec;
  const isDevPreview = process.env.NODE_ENV !== "production";

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          opacity: stageOpacity,
          transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
          filter: blurPx > 0.05 ? `blur(${blurPx}px)` : undefined,
        }}
      >
        <BeatComponent {...componentProps} />
      </AbsoluteFill>

      {isDevPreview && beatDurationSec > maxAllowedSec + 0.01 && (
        <PacingRuleWarning
          durationSec={beatDurationSec}
          maxSec={maxAllowedSec}
        />
      )}
    </AbsoluteFill>
  );
};

export interface TimelineRendererProps {
  /** İsteğe bağlı özel timeline; verilmezse `source` seçimine göre yüklenir */
  timeline?: TimelineSpec;
  /** `"timeline"` -> `src/data/timeline.json`, `"chapters"` -> `src/data/chapters/*.json` birleşimi */
  source?: "timeline" | "chapters";
}

/**
 * TimelineRenderer (v3.0 Ana Video Motoru)
 * - Çoklu tema profilleri (`obsidianAmber`, `crtPhosphor`, `blueprintCyan`, `editorialPaper`) + `ThemeProvider`
 * - Merkezi yönetmen konfigürasyonu (`src/config/director.json`) ile zamanlama ve geçiş kontrolü
 * - Global kesintisiz arka plan katmanı + CRT scanline dokusu + tema uyumlu film greni
 * - 13 kilitli bileşen (prosedürel SVG simülasyonları, B-Roll video, kaynakça dahil)
 * - Tekil `timeline.json` veya alfabetik birleşik `chapters/*.json` desteği
 */
export const TimelineRenderer: React.FC<TimelineRendererProps> = ({
  timeline,
  source = "timeline",
}) => {
  const { fps, durationInFrames: totalFrames } = useVideoConfig();

  const resolvedTimeline: TimelineSpec = React.useMemo(() => {
    if (timeline) return timeline;
    if (source === "chapters") {
      const merged = mergeChapters(loadChapters());
      if (merged) return merged;
    }
    return DEFAULT_TIMELINE;
  }, [timeline, source]);

  const activeTheme = React.useMemo(
    () => resolveTheme(resolvedTimeline.theme ?? DIRECTOR_CONFIG.activeTheme),
    [resolvedTimeline.theme]
  );

  const themeCssVars = React.useMemo(
    () => themeToCssVars(activeTheme) as React.CSSProperties,
    [activeTheme]
  );

  const mainAudioPath =
    resolvedTimeline.audio && resolvedTimeline.audio.trim().length > 0
      ? resolveAudioPath(resolvedTimeline.audio.trim())
      : null;

  const bgMusicPath =
    resolvedTimeline.bgMusic && resolvedTimeline.bgMusic.trim().length > 0
      ? resolveAudioPath(resolvedTimeline.bgMusic.trim())
      : null;

  const baseBgVolume = resolvedTimeline.bgMusicVolume ?? 0.06;
  const fadeInFrames = Math.max(1, secToFrames(0.7, fps));
  const fadeOutFrames = Math.max(1, secToFrames(0.9, fps));
  const showHud = resolvedTimeline.showHud ?? true;

  return (
    <ThemeProvider theme={activeTheme}>
      <AbsoluteFill
        style={{
          backgroundColor: COLORS.background,
          ...themeCssVars,
        }}
      >
        {/* 1. KATMAN: Global Sürekli Arka Plan (sahne geçişlerinde sıfırlanmaz) */}
        <PersistentBackgroundLayer
          beats={resolvedTimeline.beats}
          defaultBackground={resolvedTimeline.background}
        />

        {/* Ana konuşma sesi (tam seviye: 1.0) */}
        {mainAudioPath && (
          <Audio
            src={staticFile(mainAudioPath)}
            startFrom={
              resolvedTimeline.audioOffsetSec &&
              resolvedTimeline.audioOffsetSec > 0
                ? secToFrames(resolvedTimeline.audioOffsetSec, fps)
                : undefined
            }
            volume={resolvedTimeline.audioVolume ?? 1}
          />
        )}

        {/* Bölüm bazlı birleştirilmiş bireysel konuşma ses parçaları */}
        {resolvedTimeline.audioSegments?.map((seg, idx) => {
          const fromFrame = secToFrames(seg.startSec, fps);
          const segFrames = seg.durationSec
            ? Math.max(1, secToFrames(seg.durationSec, fps))
            : undefined;
          return (
            <Sequence
              key={`audio-seg-${idx}`}
              from={fromFrame}
              durationInFrames={segFrames}
            >
              <Audio
                src={staticFile(resolveAudioPath(seg.src))}
                volume={seg.volume ?? 1}
              />
            </Sequence>
          );
        })}

        {/* Hafif, döngülü arka plan ambiyansı */}
        {bgMusicPath && (
          <Audio
            src={staticFile(bgMusicPath)}
            loop
            volume={(f) => {
              const fadeIn = interpolate(f, [0, fadeInFrames], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const fadeOut = interpolate(
                f,
                [Math.max(0, totalFrames - fadeOutFrames), totalFrames],
                [1, 0],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }
              );
              return baseBgVolume * Math.min(fadeIn, fadeOut);
            }}
          />
        )}

        {/* 2. KATMAN: Veri güdümlü sahne (beat) dizilimi */}
        {resolvedTimeline.beats.map((beat, index) => {
          const fromFrame = secToFrames(beat.startSec, fps);
          const endFrame = secToFrames(beat.endSec, fps);
          const durationInFrames = Math.max(1, endFrame - fromFrame);

          const defaultSfx: SfxKey =
            beat.component === "MetricBanner"
              ? "thud"
              : beat.component === "CodeWindow" ||
                  beat.component === "StepCard" ||
                  beat.component === "TerminalTrace" ||
                  beat.component === "MemoryBarSim" ||
                  beat.component === "RayCastConeSim"
                ? "tick"
                : index === 0
                  ? "whoosh"
                  : "pop";
          const sfxChoice: SfxKey = beat.sfx ?? defaultSfx;
          const sfxPath = resolveSfxPath(sfxChoice);
          const sfxVolume = beat.sfxVolume ?? 0.16;

          return (
            <Sequence
              key={beat.id}
              name={`${beat.id} (${beat.component})`}
              from={fromFrame}
              durationInFrames={durationInFrames}
            >
              {sfxPath && <Audio src={staticFile(sfxPath)} volume={sfxVolume} />}

              <BeatStage
                beat={beat}
                durationInFrames={durationInFrames}
                isFirstBeat={index === 0}
                isLastBeat={index === resolvedTimeline.beats.length - 1}
              />
            </Sequence>
          );
        })}

        {/* 3. KATMAN: Minimalist Mühendislik HUD'u */}
        {showHud && (
          <EngineeringHUD
            title={resolvedTimeline.meta.title}
            beats={resolvedTimeline.beats}
          />
        )}

        {/* 4. KATMAN: Tema-özel CRT Scanline Dokusu (yalnızca scanlineOpacity > 0) */}
        <ScanlineOverlay />

        {/* 5. KATMAN: Monokrom Film Greni */}
        <FilmGrainOverlay />
      </AbsoluteFill>
    </ThemeProvider>
  );
};

export { DEFAULT_TIMELINE };

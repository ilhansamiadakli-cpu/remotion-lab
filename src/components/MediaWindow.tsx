import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Loop,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONTS, GLASS_TOKENS, MOTION, secToFrames } from "../theme";
import { CadCorners, SpecularSweep } from "./CadFrame";

export interface MediaWindowProps {
  /** `public/media/` altındaki dosya adı veya yolu (ör. "schema.png", "demo.mp4", "akis.gif") */
  src: string;
  /** Pencere üst çubuğundaki başlık */
  title?: string;
  /** Sağ üst rozet */
  badge?: string;
  /** Alt açıklama */
  caption?: string;
  /** `true` ise görsel/video üzerinde yavaş sinematik yakınlaşma (scale: 1 -> 1.08) uygular */
  zoomPan?: boolean;
  /** Video oynatma hızı (yalnızca .mp4/.webm/.mov) */
  playbackRate?: number;
  /** Video sessiz mi oynasın? (varsayılan true — B-Roll için önerilir) */
  muted?: boolean;
  /** B-Roll video klibini sahne boyunca pürüzsüz döngüye al (varsayılan true) */
  loop?: boolean;
  /** Döngüye alınacak kaynak video uzunluğu (saniye; verilmezse sahne süresi kullanılır) */
  loopDurationSec?: number;
  /** Videonun başlangıç kesim noktası (saniye) */
  startFromSec?: number;
  /** Medya sığdırma modu (`"cover"` varsayılan, diyagramlar için `"contain"`) */
  objectFit?: "cover" | "contain";
  /** `SplitStage` gibi üst bileşenlerin içine gömüldüğünde `<AbsoluteFill>` sarmalayıcısını kaldırır */
  embedded?: boolean;
  /** Medya görünüm alanı yüksekliği (px, varsayılan tam ekran 700, gömülü 580) */
  mediaHeight?: number;
  /** TimelineRenderer tarafından geçirilen sahne süresi (kare) */
  beatDurationInFrames?: number;
  startFrame?: number;
}

const VIDEO_EXTS = [".mp4", ".webm", ".mov"];

function resolveMediaPath(rawSrc: string): string {
  const cleaned = rawSrc.replace(/^\/+/, "");
  return cleaned.startsWith("media/") ? cleaned : `media/${cleaned}`;
}

function isVideoFile(src: string): boolean {
  const lower = src.toLowerCase();
  return VIDEO_EXTS.some((ext) => lower.endsWith(ext));
}

/**
 * MediaWindow (Kişisel İmza — CAD Köşe Nişangâhlı Medya/Video Penceresi)
 * Açık kaldığı sürece `TimelineRenderer` arka planı global katmanda `blur(6px)` ile bulanıklaştırır.
 */
export const MediaWindow: React.FC<MediaWindowProps> = ({
  src,
  title,
  badge,
  caption,
  zoomPan = false,
  playbackRate = 1,
  muted = true,
  loop = true,
  loopDurationSec,
  startFromSec = 0,
  objectFit = "cover",
  embedded = false,
  mediaHeight,
  beatDurationInFrames = 120,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - startFrame);

  const entrance = spring({
    frame: localFrame,
    fps,
    config: MOTION.editorial,
  });

  const captionSpring = spring({
    frame: Math.max(0, localFrame - secToFrames(0.24, fps)),
    fps,
    config: MOTION.snap,
  });

  const zoomScale = zoomPan
    ? interpolate(localFrame, [0, Math.max(1, beatDurationInFrames)], [1, 1.08], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.sin),
      })
    : 1;

  const panX = zoomPan
    ? interpolate(localFrame, [0, Math.max(1, beatDurationInFrames)], [0, -10], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.sin),
      })
    : 0;

  const panY = zoomPan
    ? interpolate(localFrame, [0, Math.max(1, beatDurationInFrames)], [0, -6], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.sin),
      })
    : 0;

  const mediaUrl = staticFile(resolveMediaPath(src));
  const isVideo = isVideoFile(src);
  const resolvedMediaHeight = mediaHeight ?? (embedded ? 580 : 700);

  const frameBox = (
    <div
      className="relative flex w-full flex-col"
      style={{
        maxWidth: embedded ? undefined : 1380,
        background: COLORS.glassBg,
        backdropFilter: GLASS_TOKENS.blur,
        WebkitBackdropFilter: GLASS_TOKENS.blur,
        border: COLORS.border,
        borderRadius: GLASS_TOKENS.borderRadius,
        boxShadow: `0 36px 90px rgba(0, 0, 0, 0.80), inset 0 1px 0 ${COLORS.borderHighlight}`,
        opacity: interpolate(entrance, [0, 0.55], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        transform: `translate3d(0, ${interpolate(entrance, [0, 1], [24, 0])}px, 0) scale(${interpolate(entrance, [0, 1], [0.965, 1])})`,
      }}
    >
      <CadCorners size={embedded ? 12 : 14} accent startFrame={startFrame} />
      <SpecularSweep startFrame={startFrame} />

      {/* Çerçeve üst başlık çubuğu */}
      {(title || badge) && (
        <div
          className="flex items-center justify-between px-6"
          style={{
            height: embedded ? 44 : 48,
            borderBottom: COLORS.border,
            background: "rgba(255, 255, 255, 0.018)",
          }}
        >
          <div className="flex items-center gap-3">
            <span style={{ width: 6, height: 6, background: COLORS.accent }} />
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: embedded ? 12.5 : 13.5,
                fontWeight: 500,
                color: COLORS.textPrimary,
              }}
            >
              {title ?? src}
            </span>
          </div>

          {badge && (
            <span
              className="px-2.5 py-0.5 uppercase"
              style={{
                borderRadius: 6,
                fontFamily: FONTS.mono,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.14em",
                color: COLORS.accent,
                background: COLORS.accentSoft,
                border: `1px solid ${COLORS.accentBorder}`,
              }}
            >
              {badge}
            </span>
          )}
        </div>
      )}

      {/* Medya görüntüleme alanı */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          height: resolvedMediaHeight,
          background: COLORS.canvasDeep,
          borderBottomLeftRadius: GLASS_TOKENS.borderRadius - 1,
          borderBottomRightRadius: GLASS_TOKENS.borderRadius - 1,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            transform: `translate3d(${panX}px, ${panY}px, 0) scale(${zoomScale})`,
            transformOrigin: "center center",
          }}
        >
          {isVideo ? (
            (() => {
              const trimBeforeFrames = startFromSec > 0 ? secToFrames(startFromSec, fps) : undefined;
              const videoEl = (
                <OffthreadVideo
                  src={mediaUrl}
                  muted={muted}
                  playbackRate={playbackRate}
                  trimBefore={trimBeforeFrames}
                  pauseWhenBuffering
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit,
                  }}
                />
              );
              if (!loop) {
                return videoEl;
              }
              const loopFrames = Math.max(
                1,
                loopDurationSec
                  ? secToFrames(loopDurationSec, fps)
                  : beatDurationInFrames
              );
              return <Loop durationInFrames={loopFrames}>{videoEl}</Loop>;
            })()
          ) : (
            <Img
              src={mediaUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return frameBox;
  }

  return (
    <AbsoluteFill
      className="flex flex-col items-center justify-center px-24"
      style={{ fontFamily: FONTS.sans }}
    >
      {frameBox}

      {caption && (
        <div
          className="mt-6 flex items-center gap-3 px-6 py-3"
          style={{
            borderRadius: GLASS_TOKENS.borderRadiusSm,
            background: COLORS.cardBg,
            backdropFilter: GLASS_TOKENS.blur,
            WebkitBackdropFilter: GLASS_TOKENS.blur,
            border: COLORS.border,
            opacity: interpolate(captionSpring, [0, 0.7], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translate3d(0, ${interpolate(captionSpring, [0, 1], [12, 0])}px, 0)`,
          }}
        >
          <span style={{ width: 6, height: 6, background: COLORS.accent }} />
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 14.5,
              color: COLORS.textSecondary,
            }}
          >
            {caption}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};

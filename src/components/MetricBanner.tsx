import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, GLASS_TOKENS, MOTION, secToFrames } from "../theme";
import { CadCorners, SpecularSweep } from "./CadFrame";

export interface MetricBannerProps {
  /** Büyük tipografiyle öne çıkacak kritik sayı veya kural (ör. "13 TABLO", "3NF", "93°C") */
  value: string;
  /** Değerin altındaki ana teknik başlık (ör. "3NF İLİŞKİSEL MİMARİ") */
  label: string;
  /** İsteğe bağlı destekleyici kısa açıklama */
  subtext?: string;
  /** Üst bölüm rozeti (ör. "BÖLÜM 02") */
  badge?: string;
  /** `true` ise kart çerçevesi olmadan doğrudan Obsidian boşluğu üzerinde dev tipografi sunar (varsayılan: true) */
  frameless?: boolean;
  startFrame?: number;
}

/**
 * MetricBanner (Kişisel İmza — Varsayılan Kartsız Frameless Vuruş + `MOTION.impact`)
 * Bölüm geçişlerinde tek bir kritik sayıyı veya mimari kuralı kutu kalabalığı olmadan
 * saf Obsidian boşluğu üstünde büyük, yüksek kontrastlı tipografiyle patlatır.
 */
export const MetricBanner: React.FC<MetricBannerProps> = ({
  value,
  label,
  subtext,
  badge,
  frameless = true,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - startFrame);

  const valueSpring = spring({
    frame: localFrame,
    fps,
    config: MOTION.impact,
  });

  const dividerSpring = spring({
    frame: Math.max(0, localFrame - secToFrames(0.14, fps)),
    fps,
    config: MOTION.editorial,
  });

  const labelSpring = spring({
    frame: Math.max(0, localFrame - secToFrames(0.22, fps)),
    fps,
    config: MOTION.editorial,
  });

  const badgePop = spring({
    frame: Math.max(0, localFrame - secToFrames(0.05, fps)),
    fps,
    config: MOTION.snap,
  });

  const valueFontSize = value.length > 12 ? 104 : value.length > 8 ? 124 : 148;
  const opticalBlur = interpolate(valueSpring, [0, 0.55], [4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const innerContent = (
    <>
      {badge && (
        <div
          className="mb-8 flex items-center gap-2.5 px-4 py-1.5"
          style={{
            borderRadius: GLASS_TOKENS.borderRadiusSm,
            background: COLORS.accentSoft,
            border: `1px solid ${COLORS.accentBorder}`,
            transform: `scale(${interpolate(badgePop, [0, 1], [0.88, 1])})`,
          }}
        >
          <span style={{ width: 6, height: 6, background: COLORS.accent }} />
          <span
            className="uppercase tracking-[0.24em]"
            style={{
              fontFamily: FONTS.mono,
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.accent,
            }}
          >
            {badge}
          </span>
        </div>
      )}

      {/* Dev yüksek kontrastlı sayı / kural */}
      <div
        style={{
          fontSize: valueFontSize,
          fontWeight: 700,
          lineHeight: 1.02,
          letterSpacing: "-0.04em",
          fontVariantNumeric: "tabular-nums",
          background: `linear-gradient(180deg, ${COLORS.textBright} 30%, ${COLORS.accent} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          filter: `drop-shadow(0 14px 36px ${COLORS.accentGlow})`,
        }}
      >
        {value}
      </div>

      {/* Merkezden açılan ince sıcak kehribar ayırıcı çizgi */}
      <div
        className="my-8"
        style={{
          width: 260,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${COLORS.accent}, transparent)`,
          boxShadow: `0 0 16px ${COLORS.accentGlow}`,
          transform: `scaleX(${dividerSpring})`,
          transformOrigin: "center center",
        }}
      />

      {/* Ana teknik başlık */}
      <div
        className="uppercase tracking-[0.24em]"
        style={{
          fontFamily: FONTS.mono,
          fontSize: 26,
          fontWeight: 600,
          color: COLORS.textPrimary,
          opacity: interpolate(labelSpring, [0, 0.7], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          transform: `translate3d(0, ${interpolate(labelSpring, [0, 1], [14, 0])}px, 0)`,
        }}
      >
        {label}
      </div>

      {subtext && (
        <p
          className="m-0 mt-5 max-w-2xl"
          style={{
            fontSize: 22,
            lineHeight: 1.5,
            color: COLORS.textSecondary,
            opacity: interpolate(labelSpring, [0.15, 0.85], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translate3d(0, ${interpolate(labelSpring, [0, 1], [12, 0])}px, 0)`,
          }}
        >
          {subtext}
        </p>
      )}
    </>
  );

  return (
    <AbsoluteFill
      className="flex flex-col items-center justify-center px-24 text-center"
      style={{ fontFamily: FONTS.sans }}
    >
      {/* Arka planda değerle birlikte nefes alan sıcak kehribar odak halesi */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          width: 920,
          height: 460,
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(245, 158, 11, 0.14) 0%, rgba(245, 158, 11, 0.03) 45%, transparent 72%)",
          transform: `scale(${interpolate(valueSpring, [0, 1], [0.76, 1.04])})`,
          opacity: interpolate(valueSpring, [0, 1], [0, 1]),
          pointerEvents: "none",
        }}
      />

      {frameless ? (
        <div
          className="relative flex flex-col items-center"
          style={{
            opacity: interpolate(valueSpring, [0, 0.45], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translate3d(0, ${interpolate(valueSpring, [0, 1], [32, 0])}px, 0) scale(${interpolate(valueSpring, [0, 1], [0.92, 1])})`,
            filter: opticalBlur > 0.05 ? `blur(${opticalBlur}px)` : undefined,
          }}
        >
          {innerContent}
        </div>
      ) : (
        <div
          className="relative flex flex-col items-center"
          style={{
            padding: "56px 88px",
            borderRadius: GLASS_TOKENS.borderRadius,
            background: COLORS.cardBg,
            backdropFilter: GLASS_TOKENS.blur,
            WebkitBackdropFilter: GLASS_TOKENS.blur,
            border: COLORS.border,
            boxShadow: `0 34px 86px rgba(0, 0, 0, 0.74), inset 0 1px 0 ${COLORS.borderHighlight}`,
            opacity: interpolate(valueSpring, [0, 0.5], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translate3d(0, ${interpolate(valueSpring, [0, 1], [34, 0])}px, 0) scale(${interpolate(valueSpring, [0, 1], [0.92, 1])})`,
          }}
        >
          <CadCorners size={16} accent startFrame={startFrame} />
          <SpecularSweep startFrame={startFrame} />
          {innerContent}
        </div>
      )}
    </AbsoluteFill>
  );
};

import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, GLASS_TOKENS, MOTION, secToFrames } from "../theme";

export interface CadCornersProps {
  /** Köşe nişangâh kol uzunluğu (px) */
  size?: number;
  /** Vurgulu kehribar tonu mu yoksa monokrom gümüş tonu mu? */
  accent?: boolean;
  /** Köşe çizgi kalınlığı */
  thickness?: number;
  /** Köşelerden iç boşluk (px) */
  inset?: number;
  /** Giriş başlangıç karesi */
  startFrame?: number;
}

/**
 * CAD / Teknik Çizim Köşe Nişangâhları (┌ ┐ └ ┘)
 * Tüm mühendislik kartlarına, kod pencerelerine ve medya çerçevelerine
 * kişisel, keskin donanım/şema imzası kazandırır.
 */
export const CadCorners: React.FC<CadCornersProps> = ({
  size = GLASS_TOKENS.cadTickSize,
  accent = true,
  thickness = 1.5,
  inset = -1,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - startFrame);
  const pop = spring({
    frame: localFrame,
    fps,
    config: MOTION.snap,
  });

  const color = accent ? COLORS.cadTick : COLORS.cadTickMuted;
  const opacity = interpolate(pop, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cornerBase: React.CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
    pointerEvents: "none",
    zIndex: 4,
    opacity,
  };

  return (
    <>
      {/* Sol Üst ┌ */}
      <span
        aria-hidden
        style={{
          ...cornerBase,
          top: inset,
          left: inset,
          borderTop: `${thickness}px solid ${color}`,
          borderLeft: `${thickness}px solid ${color}`,
        }}
      />
      {/* Sağ Üst ┐ */}
      <span
        aria-hidden
        style={{
          ...cornerBase,
          top: inset,
          right: inset,
          borderTop: `${thickness}px solid ${color}`,
          borderRight: `${thickness}px solid ${color}`,
        }}
      />
      {/* Sol Alt └ */}
      <span
        aria-hidden
        style={{
          ...cornerBase,
          bottom: inset,
          left: inset,
          borderBottom: `${thickness}px solid ${color}`,
          borderLeft: `${thickness}px solid ${color}`,
        }}
      />
      {/* Sağ Alt ┘ */}
      <span
        aria-hidden
        style={{
          ...cornerBase,
          bottom: inset,
          right: inset,
          borderBottom: `${thickness}px solid ${color}`,
          borderRight: `${thickness}px solid ${color}`,
        }}
      />
    </>
  );
};

export interface SpecularSweepProps {
  /** Kart oturduğunda üst 1px kenardan tek sefer geçip sönen ince ışık yansıması */
  startFrame?: number;
  color?: string;
}

/**
 * SpecularSweep: Statik neon üst parlama yerine, bileşen sahneye oturduğunda
 * üst kenardan tek sefer akıp sönen ince teknik metalik yansıma.
 */
export const SpecularSweep: React.FC<SpecularSweepProps> = ({
  startFrame = 0,
  color = COLORS.accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delayFrames = secToFrames(0.12, fps);
  const localFrame = Math.max(0, frame - (startFrame + delayFrames));

  const sweep = spring({
    frame: localFrame,
    fps,
    config: MOTION.editorial,
  });

  const xPercent = interpolate(sweep, [0, 1], [-25, 115]);
  const sweepOpacity = interpolate(sweep, [0, 0.18, 0.72, 1], [0, 0.85, 0.45, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 1,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 3,
      }}
    >
      {/* Kalıcı çok ince mat üst kenar çizgisi */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.12) 50%, transparent 95%)",
        }}
      />
      {/* Giriş anında bir kez akıp sönen kehribar ışık izi */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: `${xPercent}%`,
          width: "32%",
          height: 1.5,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          opacity: sweepOpacity,
          transform: "translateX(-50%)",
        }}
      />
    </div>
  );
};

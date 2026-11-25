import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, useActiveTheme } from "../theme";
import type { BackgroundProps } from "./ObsidianGridBg";

/**
 * RadialGlowBg: Yumuşak sıcak kehribar odak ışığı arka planı.
 * Global zaman ekseninde organik nefes alan ışık kümesiyle dikkati merkeze toplar.
 */
export const RadialGlowBg: React.FC<BackgroundProps> = ({
  blurPx = 0,
  dimOpacity = 1,
  layerOpacity = 1,
  parallaxX = 0,
  parallaxY = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useActiveTheme();
  const t = frame / fps;

  if (layerOpacity <= 0.001) {
    return null;
  }

  // Organik, yavaş nefes alan odak hareketi
  const primaryOffsetX = Math.sin(t * 0.45) * 40 + parallaxX * 0.6;
  const primaryOffsetY = Math.cos(t * 0.36) * 24 + parallaxY * 0.6;
  const primaryScale = 1 + Math.sin(t * 0.6) * 0.05;

  const secondaryOffsetX = Math.cos(t * 0.4) * 52 - parallaxX * 0.4;
  const secondaryOffsetY = Math.sin(t * 0.3) * 28 - parallaxY * 0.4;

  return (
    <AbsoluteFill
      style={{
        opacity: layerOpacity,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <AbsoluteFill
        style={{
          filter: blurPx > 0.01 ? `blur(${blurPx}px)` : undefined,
          opacity: dimOpacity,
          transform: blurPx > 0.01 ? "scale(1.035)" : "scale(1)",
        }}
      >
        {/* Ana merkez temaya uyumlu odak ışığı */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "48%",
            width: 1180,
            height: 700,
            transform: `translate(calc(-50% + ${primaryOffsetX}px), calc(-50% + ${primaryOffsetY}px)) scale(${primaryScale})`,
            background: `radial-gradient(ellipse at center, rgba(${theme.colors.accentRgb}, ${theme.isLight ? 0.09 : 0.11}) 0%, rgba(${theme.colors.accentRgb}, 0.03) 42%, transparent 72%)`,
            pointerEvents: "none",
          }}
        />

        {/* İkincil derinlik halesi */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "56%",
            width: 880,
            height: 500,
            transform: `translate(calc(-50% - ${secondaryOffsetX}px), calc(-50% + ${secondaryOffsetY}px))`,
            background: `radial-gradient(ellipse at center, ${COLORS.ambientSecondary} 0%, transparent 66%)`,
            pointerEvents: "none",
          }}
        />

        {/* Kenar karartması */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse 80% 80% at 50% 50%, transparent 45%, ${COLORS.vignetteColor} 100%)`,
            pointerEvents: "none",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

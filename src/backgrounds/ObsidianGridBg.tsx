import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, useActiveTheme } from "../theme";

export interface BackgroundProps {
  /** Odak kartı veya medya penceresi açıkken arka plana uygulanacak alan derinliği bulanıklığı (px) */
  blurPx?: number;
  /** Arka planı hafifçe geri plana almak için opaklık çarpanı */
  dimOpacity?: number;
  /** Global arka plan geçişi (cross-fade) opaklığı (0..1) */
  layerOpacity?: number;
  /** Sahne geçişlerinde hafif kamera paralaksı (px) */
  parallaxX?: number;
  parallaxY?: number;
}

/**
 * ObsidianGridBg: Global zaman ekseninde kesintisiz akan ince mühendislik ızgarası.
 * Sahne geçişlerinde asla başa sarmaz; sıcak kehribar ortam ışığıyla Obsidian derinliği verir.
 */
export const ObsidianGridBg: React.FC<BackgroundProps> = ({
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

  // Sürekli ve organik paralaks akışı (global `frame` üzerinden)
  const driftX = t * 11 + Math.sin(t * 0.35) * 5 + parallaxX;
  const driftY = t * 7 + Math.cos(t * 0.28) * 4 + parallaxY;
  const glowPulse = 0.048 + Math.sin(t * 0.65) * 0.012;

  if (layerOpacity <= 0.001) {
    return null;
  }

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
        {/* İnce teknik çizgi ızgarası */}
        <div
          style={{
            position: "absolute",
            inset: -120,
            backgroundImage: `
              linear-gradient(to right, ${COLORS.gridLine} 1px, transparent 1px),
              linear-gradient(to bottom, ${COLORS.gridLine} 1px, transparent 1px)
            `,
            backgroundSize: "56px 56px",
            backgroundPosition: `${driftX}px ${driftY}px`,
            maskImage:
              "radial-gradient(ellipse 78% 76% at 50% 50%, black 35%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 78% 76% at 50% 50%, black 35%, transparent 100%)",
          }}
        />

        {/* Merkezde temaya uyumlu atmosferik ışık */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "46%",
            width: 1180,
            height: 620,
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(ellipse at center, rgba(${theme.colors.accentRgb}, ${glowPulse}) 0%, transparent 66%)`,
            pointerEvents: "none",
          }}
        />

        {/* Yumuşak kenar karartması (vignette) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse 84% 84% at 50% 50%, transparent 50%, ${COLORS.canvasDeep} 100%)`,
            opacity: theme.isLight ? 0.38 : 0.65,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

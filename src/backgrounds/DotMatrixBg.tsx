import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, useActiveTheme } from "../theme";
import type { BackgroundProps } from "./ObsidianGridBg";

/**
 * DotMatrixBg: Global zaman ekseninde kesintisiz akan noktalı mühendislik matrisi.
 * Monokrom gümüş noktalar ve hafif sıcak kehribar derinlik ışığı içerir.
 */
export const DotMatrixBg: React.FC<BackgroundProps> = ({
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

  const shiftX = t * 10 + Math.sin(t * 0.34) * 4 + parallaxX;
  const shiftY = t * 6.5 + Math.cos(t * 0.26) * 3.5 + parallaxY;
  const ambientOpacity = 0.058 + Math.sin(t * 0.6) * 0.012;

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
        {/* Noktalı mühendislik matrisi */}
        <div
          style={{
            position: "absolute",
            inset: -120,
            backgroundImage: `radial-gradient(${COLORS.dotColor} 1.3px, transparent 1.3px)`,
            backgroundSize: "38px 38px",
            backgroundPosition: `${shiftX}px ${shiftY}px`,
            maskImage:
              "radial-gradient(ellipse 76% 74% at 50% 50%, black 40%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 76% 74% at 50% 50%, black 40%, transparent 100%)",
          }}
        />

        {/* Temaya uyumlu yumuşak derinlik ışığı */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 1100,
            height: 600,
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(ellipse at center, rgba(${theme.colors.accentRgb}, ${ambientOpacity}) 0%, transparent 64%)`,
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse 84% 84% at 50% 50%, transparent 50%, ${COLORS.canvasDeep} 100%)`,
            opacity: theme.isLight ? 0.35 : 0.65,
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

import React, { useId } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, GLASS_TOKENS, MOTION, VIDEO_CONFIG, secToFrames } from "../theme";

export interface Point {
  x: number;
  y: number;
}

export interface DashedConnectorProps {
  /** Bağlantının başladığı (x, y) koordinatı */
  from: Point;
  /** Bağlantının hedeflediği (x, y) koordinatı */
  to: Point;
  /** Bağlantı çiziminin başlayacağı kare (frame) */
  startFrame?: number;
  /** Eğri ortasında yer alan teknik etiket */
  label?: string;
  /** Çizgi ve ok ucu rengi */
  color?: string;
  /** Çizgi kalınlığı */
  strokeWidth?: number;
  /** Kesikli çizgi deseni */
  dashArray?: string;
  /** Saniyedeki nokta akış hızı (px/sn — 30/60 fps'de birebir aynı hız) */
  flowPixelsPerSec?: number;
  /** Kübik Bezier kıvrım şiddeti */
  curvature?: number;
  /** Eğri boyunca hareket eden ışıklı veri paketi nabzı gösterilsin mi? (varsayılan: true) */
  showPulse?: boolean;
}

/**
 * İki koordinat arasında kübik Bezier eğrisi çizen ve `strokeDashoffset` ile
 * FPS-bağımsız hızda veri/süreç akışı canlandıran SVG bağlantı oku.
 */
export const DashedConnector: React.FC<DashedConnectorProps> = ({
  from,
  to,
  startFrame = 0,
  label,
  color = COLORS.accent,
  strokeWidth = 2.2,
  dashArray = "8 7",
  flowPixelsPerSec = 76,
  curvature = 0.5,
  showPulse = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const uid = useId().replace(/:/g, "");
  const maskId = `connector-reveal-${uid}`;
  const glowId = `connector-glow-${uid}`;

  const localFrame = Math.max(0, frame - startFrame);

  // `MOTION.editorial` ile eğrinin soldan sağa organik açılması
  const revealProgress = spring({
    frame: localFrame,
    fps,
    config: MOTION.editorial,
  });

  // Saniye bazlı akış hızı: 30fps ve 60fps'de aynı görsel akış hızını garanti eder
  const dashFlowOffset = -((localFrame / fps) * flowPixelsPerSec);

  const originPop = spring({
    frame: localFrame,
    fps,
    config: MOTION.snap,
  });

  const arrowPop = spring({
    frame: Math.max(0, localFrame - secToFrames(0.26, fps)),
    fps,
    config: MOTION.snap,
  });

  const labelPop = spring({
    frame: Math.max(0, localFrame - secToFrames(0.20, fps)),
    fps,
    config: MOTION.snap,
  });

  // Kübik Bezier kontrol noktaları
  const dx = to.x - from.x;
  const cp1: Point = { x: from.x + dx * curvature, y: from.y };
  const cp2: Point = { x: to.x - dx * curvature, y: to.y };

  const pathD = `M ${from.x} ${from.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${to.x} ${to.y}`;

  // t = 0.5 Bezier orta noktası
  const midX = 0.125 * from.x + 0.375 * cp1.x + 0.375 * cp2.x + 0.125 * to.x;
  const midY = 0.125 * from.y + 0.375 * cp1.y + 0.375 * cp2.y + 0.125 * to.y;

  // Bitiş noktasındaki teğet açısı
  const arrowAngle = Math.atan2(to.y - cp2.y, to.x - cp2.x) * (180 / Math.PI);

  // Eğri boyunca akan ışıklı veri paketi (küçük kehribar nabız noktası)
  const pulseCycle = ((localFrame / fps) * 0.55) % 1;
  const u = 1 - pulseCycle;
  const pulseX =
    u * u * u * from.x +
    3 * u * u * pulseCycle * cp1.x +
    3 * u * pulseCycle * pulseCycle * cp2.x +
    pulseCycle * pulseCycle * pulseCycle * to.x;
  const pulseY =
    u * u * u * from.y +
    3 * u * u * pulseCycle * cp1.y +
    3 * u * pulseCycle * pulseCycle * cp2.y +
    pulseCycle * pulseCycle * pulseCycle * to.y;
  const pulseOpacity =
    showPulse && revealProgress > 0.85
      ? Math.sin(Math.PI * pulseCycle) * 0.95
      : 0;

  if (frame < startFrame) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        width={VIDEO_CONFIG.width}
        height={VIDEO_CONFIG.height}
        viewBox={`0 0 ${VIDEO_CONFIG.width} ${VIDEO_CONFIG.height}`}
        fill="none"
        style={{ overflow: "visible" }}
      >
        <defs>
          <filter id={glowId} x="-25%" y="-45%" width="150%" height="190%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <mask id={maskId}>
            <path
              d={pathD}
              stroke="white"
              strokeWidth={strokeWidth + 14}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={Math.max(0, 1 - revealProgress)}
            />
          </mask>
        </defs>

        <g mask={`url(#${maskId})`}>
          <path
            d={pathD}
            stroke={color}
            strokeWidth={strokeWidth + 3.5}
            strokeOpacity={0.14}
            strokeLinecap="round"
          />
          <path
            d={pathD}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            strokeDashoffset={dashFlowOffset}
            strokeLinecap="round"
            filter={`url(#${glowId})`}
          />
        </g>

        {/* Başlangıç bağlantı noktası (keskin kare-halka CAD pini) */}
        <g transform={`translate(${from.x}, ${from.y}) scale(${originPop})`}>
          <circle r={7.5} fill={color} fillOpacity={0.16} />
          <circle r={3.8} fill={COLORS.background} stroke={color} strokeWidth={2} />
        </g>

        {/* Eğri boyunca akan ışıklı veri paketi */}
        {pulseOpacity > 0.02 && (
          <g
            transform={`translate(${pulseX}, ${pulseY})`}
            opacity={pulseOpacity}
            filter={`url(#${glowId})`}
          >
            <circle r={7} fill={color} fillOpacity={0.28} />
            <circle r={3.4} fill={COLORS.textBright} stroke={color} strokeWidth={1.6} />
          </g>
        )}

        {/* Ok ucu */}
        <g
          transform={`translate(${to.x}, ${to.y}) rotate(${arrowAngle}) scale(${arrowPop})`}
          filter={`url(#${glowId})`}
        >
          <path d="M -12 -6 L 1 0 L -12 6 L -8.8 0 Z" fill={color} />
        </g>
      </svg>

      {label && (
        <div
          style={{
            position: "absolute",
            left: midX,
            top: midY,
            transform: `translate(-50%, -50%) scale(${interpolate(labelPop, [0, 1], [0.86, 1])})`,
            opacity: interpolate(labelPop, [0, 0.7], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            background: "rgba(7, 9, 13, 0.94)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: `1px solid ${COLORS.accentBorder}`,
            boxShadow: `0 10px 24px rgba(0, 0, 0, 0.72), 0 0 14px ${COLORS.accentGlow}`,
            borderRadius: GLASS_TOKENS.borderRadiusSm,
            padding: "5px 12px",
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              background: color,
            }}
          />
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 12.5,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: COLORS.textPrimary,
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        </div>
      )}
    </div>
  );
};

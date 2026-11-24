import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, GLASS_TOKENS, MOTION, secToFrames } from "../theme";
import { CadCorners, SpecularSweep } from "./CadFrame";

export interface GlassCardItem {
  label: string;
  value: string;
  tag?: string;
  highlighted?: boolean;
}

export interface GlassCardProps {
  /** Kartın ana başlığı */
  title: string;
  /** Başlık üstündeki küçük monospace etiket */
  subtitle?: string;
  /** Sağ üst köşe rozeti (badge) */
  badge?: string;
  /** Veri güdümlü kullanım için opsiyonel açıklama paragrafı */
  body?: string;
  /** Yapılandırılmış anahtar-değer satırları */
  items?: GlassCardItem[];
  /** Kart alt şeridinde gösterilecek opsiyonel not */
  footer?: string;
  /** Kartın yay fiziğiyle açılmaya başlayacağı yerel kare */
  startFrame?: number;
  /** Sabit genişlik (px) */
  width?: number;
  /** Sahne bileşeni olarak tam ortalanmış modda mı çalışsın? */
  centered?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * GlassCard (Kişisel İmza — CAD Köşe Nişangâhlı, 12px Keskin Odak Kartı)
 * `backdrop-filter: blur(12px)`, ince kenarlık, tek seferlik specular sweep ve
 * FPS-bağımsız `MOTION.editorial` yay fiziğiyle açılır.
 */
export const GlassCard: React.FC<GlassCardProps> = ({
  title,
  subtitle,
  badge,
  body,
  items,
  footer,
  startFrame = 0,
  width,
  centered = true,
  className = "",
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - startFrame);

  const entrance = spring({
    frame: localFrame,
    fps,
    config: MOTION.editorial,
  });

  const badgePop = spring({
    frame: Math.max(0, localFrame - secToFrames(0.14, fps)),
    fps,
    config: MOTION.snap,
  });

  const translateY = interpolate(entrance, [0, 1], [32, 0]);
  const scale = interpolate(entrance, [0, 1], [0.955, 1]);
  const opacity = interpolate(entrance, [0, 0.55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const resolvedWidth = width ?? (centered ? 840 : 480);

  const cardNode = (
    <div
      className={`relative ${className}`}
      style={{
        width: resolvedWidth,
        background: COLORS.glassBg,
        backdropFilter: GLASS_TOKENS.blur,
        WebkitBackdropFilter: GLASS_TOKENS.blur,
        border: COLORS.border,
        borderRadius: GLASS_TOKENS.borderRadius,
        boxShadow: `0 30px 76px rgba(0, 0, 0, 0.75), inset 0 1px 0 ${COLORS.borderHighlight}`,
        fontFamily: FONTS.sans,
        opacity,
        transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
        transformOrigin: "center center",
        ...style,
      }}
    >
      <CadCorners size={13} accent startFrame={startFrame} />
      <SpecularSweep startFrame={startFrame} />

      {/* Kart başlığı (sabit 92px yükseklik) */}
      <div
        className="flex items-center justify-between px-7"
        style={{
          height: 92,
          borderBottom: COLORS.border,
          background: "rgba(255, 255, 255, 0.016)",
        }}
      >
        <div className="flex flex-col gap-1.5">
          {subtitle && (
            <span
              className="uppercase tracking-[0.2em]"
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                fontWeight: 500,
                color: COLORS.textSecondary,
              }}
            >
              {subtitle}
            </span>
          )}
          <h3
            className="m-0 leading-none"
            style={{
              fontSize: 27,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: COLORS.textPrimary,
            }}
          >
            {title}
          </h3>
        </div>

        {badge && (
          <span
            className="px-3 py-1"
            style={{
              borderRadius: GLASS_TOKENS.borderRadiusSm,
              fontFamily: FONTS.mono,
              fontSize: 12,
              fontWeight: 600,
              color: COLORS.accent,
              background: COLORS.accentSoft,
              border: `1px solid ${COLORS.accentBorder}`,
              fontVariantNumeric: "tabular-nums",
              transform: `scale(${interpolate(badgePop, [0, 1], [0.88, 1])})`,
            }}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Gövde alanı */}
      <div className="p-6">
        {body && (
          <p
            className="m-0 mb-5"
            style={{
              fontSize: 20,
              lineHeight: 1.58,
              color: COLORS.textSecondary,
            }}
          >
            {body}
          </p>
        )}

        {items && items.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {items.map((item, idx) => {
              const rowDelay = secToFrames(0.16 + idx * 0.09, fps);
              const rowEntrance = spring({
                frame: Math.max(0, localFrame - rowDelay),
                fps,
                config: MOTION.snap,
              });

              const isAccent = Boolean(item.highlighted);
              return (
                <div
                  key={`${idx}-${item.label}`}
                  className="flex items-center justify-between px-4 py-3.5"
                  style={{
                    borderRadius: GLASS_TOKENS.borderRadiusSm,
                    background: isAccent ? COLORS.accentSoft : COLORS.surfaceSubtle,
                    border: isAccent ? `1px solid ${COLORS.accentBorder}` : COLORS.border,
                    opacity: interpolate(rowEntrance, [0, 0.7], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                    transform: `translate3d(0, ${interpolate(rowEntrance, [0, 1], [10, 0])}px, 0)`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        background: isAccent ? COLORS.accent : COLORS.textMuted,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: FONTS.mono,
                        fontSize: 16,
                        fontWeight: isAccent ? 600 : 500,
                        color: COLORS.textPrimary,
                      }}
                    >
                      {item.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span
                      style={{
                        fontFamily: FONTS.mono,
                        fontSize: 14,
                        color: COLORS.textSecondary,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {item.value}
                    </span>
                    {item.tag && (
                      <span
                        className="px-2 py-0.5"
                        style={{
                          borderRadius: 5,
                          fontFamily: FONTS.mono,
                          fontSize: 11,
                          fontWeight: 600,
                          color: isAccent ? COLORS.accent : COLORS.textSecondary,
                          background: isAccent
                            ? COLORS.accentSoft
                            : "rgba(255, 255, 255, 0.05)",
                          border: isAccent
                            ? `1px solid ${COLORS.accentBorder}`
                            : COLORS.border,
                        }}
                      >
                        {item.tag}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {children}

        {footer && (
          <div
            className="mt-5 px-4 py-3"
            style={{
              borderRadius: GLASS_TOKENS.borderRadiusSm,
              background: "rgba(255, 255, 255, 0.022)",
              border: COLORS.border,
              fontFamily: FONTS.mono,
              fontSize: 13,
              color: COLORS.textSecondary,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  if (!centered) {
    return cardNode;
  }

  return (
    <AbsoluteFill className="flex items-center justify-center">
      {cardNode}
    </AbsoluteFill>
  );
};

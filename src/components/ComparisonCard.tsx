import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, GLASS_TOKENS, MOTION, secToFrames } from "../theme";
import { CadCorners, SpecularSweep } from "./CadFrame";

export interface ComparisonCardProps {
  /** Sahne üst başlığı (isteğe bağlı) */
  title?: string;
  /** Başlık üstündeki küçük teknik etiket */
  eyebrow?: string;
  /** Sol sütun başlığı (eski / hatalı yöntem) */
  leftTitle: string;
  /** Sol sütun uyarı rozeti */
  leftBadge?: string;
  /** Sol sütun maddeleri */
  leftItems: string[];
  /** Sağ sütun başlığı (3NF / doğru mimari) */
  rightTitle: string;
  /** Sağ sütun onay rozeti */
  rightBadge?: string;
  /** Sağ sütun maddeleri */
  rightItems: string[];
  /** Alt özet notu */
  caption?: string;
  startFrame?: number;
}

/**
 * ComparisonCard (Kişisel İmza — Semantik Theme Tokenları + CAD Köşeli Karşılaştırma)
 * Sol sütun kırmızı hata dili (`COLORS.danger`), sağ sütun imza kehribar + yeşil onay dili.
 */
export const ComparisonCard: React.FC<ComparisonCardProps> = ({
  title,
  eyebrow,
  leftTitle,
  leftBadge = "ESKİ / HATALI",
  leftItems,
  rightTitle,
  rightBadge = "DOĞRU MİMARİ",
  rightItems,
  caption,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - startFrame);

  const headerSpring = spring({
    frame: localFrame,
    fps,
    config: MOTION.editorial,
  });

  const leftDelay = secToFrames(0.06, fps);
  const rightDelay = secToFrames(0.22, fps);

  const leftSpring = spring({
    frame: Math.max(0, localFrame - leftDelay),
    fps,
    config: MOTION.editorial,
  });

  const rightSpring = spring({
    frame: Math.max(0, localFrame - rightDelay),
    fps,
    config: MOTION.editorial,
  });

  const vsPop = spring({
    frame: Math.max(0, localFrame - secToFrames(0.16, fps)),
    fps,
    config: MOTION.snap,
  });

  const captionSpring = spring({
    frame: Math.max(0, localFrame - secToFrames(0.42, fps)),
    fps,
    config: MOTION.editorial,
  });

  return (
    <AbsoluteFill
      className="flex flex-col items-center justify-center px-24"
      style={{ fontFamily: FONTS.sans }}
    >
      {/* Üst başlık */}
      {(eyebrow || title) && (
        <div
          className="mb-10 flex flex-col items-center text-center"
          style={{
            opacity: interpolate(headerSpring, [0, 0.65], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translate3d(0, ${interpolate(headerSpring, [0, 1], [18, 0])}px, 0)`,
          }}
        >
          {eyebrow && (
            <div
              className="mb-3.5 flex items-center gap-2 px-3.5 py-1.5"
              style={{
                borderRadius: GLASS_TOKENS.borderRadiusSm,
                background: COLORS.accentSoft,
                border: `1px solid ${COLORS.accentBorder}`,
              }}
            >
              <span style={{ width: 5, height: 5, background: COLORS.accent }} />
              <span
                className="uppercase tracking-[0.2em]"
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  fontWeight: 600,
                  color: COLORS.accent,
                }}
              >
                {eyebrow}
              </span>
            </div>
          )}

          {title && (
            <h2
              className="m-0"
              style={{
                fontSize: 40,
                fontWeight: 600,
                letterSpacing: "-0.025em",
                color: COLORS.textPrimary,
              }}
            >
              {title}
            </h2>
          )}
        </div>
      )}

      {/* İki Sütunlu Karşılaştırma Izgarası */}
      <div className="relative flex w-full max-w-[1480px] items-stretch gap-10">
        {/* SOL SÜTUN: Eski / Hatalı Yöntem */}
        <div
          className="relative flex flex-1 flex-col"
          style={{
            background: COLORS.glassBg,
            backdropFilter: GLASS_TOKENS.blur,
            WebkitBackdropFilter: GLASS_TOKENS.blur,
            border: `1px solid ${COLORS.dangerBorder}`,
            borderRadius: GLASS_TOKENS.borderRadius,
            boxShadow: `0 28px 72px rgba(0, 0, 0, 0.74), inset 0 1px 0 ${COLORS.borderHighlight}`,
            opacity: interpolate(leftSpring, [0, 0.55], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translate3d(${interpolate(leftSpring, [0, 1], [-24, 0])}px, ${interpolate(leftSpring, [0, 1], [18, 0])}px, 0) scale(${interpolate(leftSpring, [0, 1], [0.965, 1])})`,
          }}
        >
          <CadCorners size={12} accent={false} startFrame={startFrame + leftDelay} />
          <SpecularSweep startFrame={startFrame + leftDelay} color={COLORS.danger} />

          <div
            className="flex items-center justify-between px-8 py-6"
            style={{
              borderBottom: COLORS.border,
              background: "rgba(248, 113, 113, 0.025)",
            }}
          >
            <h3
              className="m-0"
              style={{
                fontSize: 27,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: COLORS.textPrimary,
              }}
            >
              {leftTitle}
            </h3>

            <span
              className="flex items-center gap-2 px-3 py-1 uppercase"
              style={{
                borderRadius: 6,
                fontFamily: FONTS.mono,
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: COLORS.danger,
                background: COLORS.dangerSoft,
                border: `1px solid ${COLORS.dangerBorder}`,
              }}
            >
              <span>▲</span>
              {leftBadge}
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-3.5 p-7">
            {leftItems.map((item, idx) => {
              const itemSpring = spring({
                frame: Math.max(0, localFrame - secToFrames(0.16 + idx * 0.08, fps)),
                fps,
                config: MOTION.editorial,
              });

              return (
                <div
                  key={`left-${idx}`}
                  className="flex items-start gap-4 px-5 py-4"
                  style={{
                    borderRadius: GLASS_TOKENS.borderRadiusSm,
                    background: "rgba(248, 113, 113, 0.04)",
                    border: COLORS.border,
                    opacity: interpolate(itemSpring, [0, 0.65], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                    transform: `translate3d(0, ${interpolate(itemSpring, [0, 1], [12, 0])}px, 0)`,
                  }}
                >
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center"
                    style={{
                      borderRadius: 6,
                      fontFamily: FONTS.mono,
                      fontSize: 13,
                      fontWeight: 700,
                      color: COLORS.danger,
                      background: COLORS.dangerSoft,
                      border: `1px solid ${COLORS.dangerBorder}`,
                    }}
                  >
                    ✕
                  </span>
                  <span
                    style={{
                      fontSize: 20.5,
                      lineHeight: 1.45,
                      color: COLORS.textSecondary,
                    }}
                  >
                    {item}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ORTA AYIRICI ROZET */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex h-12 w-12 items-center justify-center"
          style={{
            borderRadius: GLASS_TOKENS.borderRadiusSm,
            background: COLORS.background,
            border: `1px solid ${COLORS.accentBorder}`,
            boxShadow: `0 12px 28px rgba(0, 0, 0, 0.85)`,
            fontFamily: FONTS.mono,
            fontSize: 13,
            fontWeight: 700,
            color: COLORS.accent,
            transform: `translate(-50%, -50%) scale(${vsPop})`,
          }}
        >
          VS
        </div>

        {/* SAĞ SÜTUN: 3NF / Doğru Mimari */}
        <div
          className="relative flex flex-1 flex-col"
          style={{
            background: COLORS.glassBg,
            backdropFilter: GLASS_TOKENS.blur,
            WebkitBackdropFilter: GLASS_TOKENS.blur,
            border: `1px solid ${COLORS.accentBorder}`,
            borderRadius: GLASS_TOKENS.borderRadius,
            boxShadow: `0 30px 76px rgba(0, 0, 0, 0.76), 0 0 36px ${COLORS.accentGlow}, inset 0 1px 0 ${COLORS.borderHighlight}`,
            opacity: interpolate(rightSpring, [0, 0.55], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translate3d(${interpolate(rightSpring, [0, 1], [24, 0])}px, ${interpolate(rightSpring, [0, 1], [18, 0])}px, 0) scale(${interpolate(rightSpring, [0, 1], [0.965, 1])})`,
          }}
        >
          <CadCorners size={12} accent startFrame={startFrame + rightDelay} />
          <SpecularSweep startFrame={startFrame + rightDelay} color={COLORS.accent} />

          <div
            className="flex items-center justify-between px-8 py-6"
            style={{
              borderBottom: COLORS.border,
              background: "rgba(245, 158, 11, 0.03)",
            }}
          >
            <h3
              className="m-0"
              style={{
                fontSize: 27,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: COLORS.textPrimary,
              }}
            >
              {rightTitle}
            </h3>

            <span
              className="flex items-center gap-2 px-3 py-1 uppercase"
              style={{
                borderRadius: 6,
                fontFamily: FONTS.mono,
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: COLORS.accent,
                background: COLORS.accentSoft,
                border: `1px solid ${COLORS.accentBorder}`,
              }}
            >
              <span style={{ color: COLORS.success }}>✓</span>
              {rightBadge}
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-3.5 p-7">
            {rightItems.map((item, idx) => {
              const itemSpring = spring({
                frame: Math.max(0, localFrame - secToFrames(0.30 + idx * 0.08, fps)),
                fps,
                config: MOTION.editorial,
              });

              return (
                <div
                  key={`right-${idx}`}
                  className="flex items-start gap-4 px-5 py-4"
                  style={{
                    borderRadius: GLASS_TOKENS.borderRadiusSm,
                    background: COLORS.accentSubtle,
                    border: `1px solid rgba(245, 158, 11, 0.20)`,
                    opacity: interpolate(itemSpring, [0, 0.65], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                    transform: `translate3d(0, ${interpolate(itemSpring, [0, 1], [12, 0])}px, 0)`,
                  }}
                >
                  <span
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center"
                    style={{
                      borderRadius: 6,
                      fontFamily: FONTS.mono,
                      fontSize: 13,
                      fontWeight: 700,
                      color: COLORS.success,
                      background: COLORS.successSoft,
                      border: `1px solid ${COLORS.successBorder}`,
                    }}
                  >
                    ✓
                  </span>
                  <span
                    style={{
                      fontSize: 20.5,
                      fontWeight: 500,
                      lineHeight: 1.45,
                      color: COLORS.textPrimary,
                    }}
                  >
                    {item}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Opsiyonel alt özet */}
      {caption && (
        <div
          className="mt-8 flex items-center gap-3 px-6 py-3"
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

import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, GLASS_TOKENS, MOTION, secToFrames, useActiveTheme } from "../theme";
import { CadCorners, SpecularSweep } from "./CadFrame";

export interface ReferenceItem {
  /** Kaynak başlığı (ör. "Doom Engine Black Book" veya "Xash3D FWGS Engine") */
  title: string;
  /** Yazar, kurum veya kısa açıklama */
  source?: string;
  /** Monospace repo/URL bağlantısı (ör. "github.com/FWGS/xash3d-fwgs") */
  url?: string;
  /** Kategori rozeti (ör. "GITHUB", "PAPER", "DOCS", "SPEC") */
  tag?: string;
  /** Yayın yılı */
  year?: string;
  /** İmza vurgu rengiyle öne çıkar */
  highlighted?: boolean;
}

export interface ReferenceListProps {
  /** Üst monospace kategori etiketi */
  eyebrow?: string;
  /** Ana başlık */
  title?: string;
  /** Sağ üst rozet */
  badge?: string;
  /** Kaynakça / repo listesi (ideal: 3–5 öğe) */
  items: ReferenceItem[];
  /** Alt teşekkür veya repo bağlantısı notu */
  footerNote?: string;
  startFrame?: number;
}

/**
 * ReferenceList (v3.0 Kapanış & Kaynakça Bileşeni)
 * Video kapanışlarında makale, teknik doküman ve GitHub kaynak depolarını
 * CAD çerçeveli, numaralı ve temaya uyumlu temiz bir listede sunar.
 */
export const ReferenceList: React.FC<ReferenceListProps> = ({
  eyebrow = "KAYNAKÇA & REFERANSLAR",
  title = "Teknik Kaynaklar ve Kod Depoları",
  badge = "SOURCES",
  items,
  footerNote,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useActiveTheme();

  const localFrame = Math.max(0, frame - startFrame);
  const cardSpring = spring({
    frame: localFrame,
    fps,
    config: MOTION.editorial,
  });

  const baseDelay = secToFrames(0.14, fps);
  const stagger = secToFrames(0.16, fps);

  return (
    <AbsoluteFill
      className="flex flex-col items-center justify-center px-28"
      style={{ fontFamily: FONTS.sans }}
    >
      <div
        className="relative flex w-full flex-col"
        style={{
          maxWidth: 1180,
          background: COLORS.glassBg,
          backdropFilter: GLASS_TOKENS.blur,
          WebkitBackdropFilter: GLASS_TOKENS.blur,
          border: COLORS.border,
          borderRadius: GLASS_TOKENS.borderRadius,
          boxShadow: theme.isLight
            ? `0 24px 60px rgba(17, 24, 39, 0.12), inset 0 1px 0 ${COLORS.borderHighlight}`
            : `0 34px 86px rgba(0, 0, 0, 0.78), inset 0 1px 0 ${COLORS.borderHighlight}`,
          padding: "36px 42px",
          opacity: interpolate(cardSpring, [0, 0.55], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          transform: `translate3d(0, ${interpolate(cardSpring, [0, 1], [24, 0])}px, 0) scale(${interpolate(cardSpring, [0, 1], [0.97, 1])})`,
        }}
      >
        <CadCorners size={14} accent startFrame={startFrame} />
        <SpecularSweep startFrame={startFrame} />

        {/* Üst başlık */}
        <div
          className="mb-6 flex items-start justify-between pb-5"
          style={{ borderBottom: COLORS.border }}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span style={{ width: 6, height: 6, background: COLORS.accent }} />
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
            <h2
              className="m-0"
              style={{
                fontSize: 36,
                fontWeight: 600,
                letterSpacing: "-0.025em",
                color: COLORS.textPrimary,
              }}
            >
              {title}
            </h2>
          </div>

          <span
            className="px-3.5 py-1.5 uppercase"
            style={{
              borderRadius: 6,
              fontFamily: FONTS.mono,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.14em",
              color: COLORS.accent,
              background: COLORS.accentSoft,
              border: `1px solid ${COLORS.accentBorder}`,
            }}
          >
            {badge}
          </span>
        </div>

        {/* Kaynak Satırları (Sıfır düzen sıçraması: tüm satırlar en baştan rezerve) */}
        <div className="flex flex-col gap-3.5">
          {items.slice(0, 6).map((item, idx) => {
            const itemSpring = spring({
              frame: Math.max(0, localFrame - (baseDelay + idx * stagger)),
              fps,
              config: MOTION.editorial,
            });
            const isHighlighted = Boolean(item.highlighted);

            return (
              <div
                key={`ref-${idx}-${item.title}`}
                className="flex items-center justify-between gap-6 px-5 py-4"
                style={{
                  borderRadius: GLASS_TOKENS.borderRadiusSm,
                  background: isHighlighted ? COLORS.accentSoft : COLORS.surfaceSubtle,
                  border: isHighlighted ? `1px solid ${COLORS.accentBorder}` : COLORS.border,
                  opacity: interpolate(itemSpring, [0, 0.7], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                  transform: `translate3d(${interpolate(itemSpring, [0, 1], [16, 0])}px, 0, 0)`,
                }}
              >
                <div className="flex items-center gap-4">
                  <span
                    className="flex items-center justify-center px-2.5 py-1"
                    style={{
                      borderRadius: 5,
                      fontFamily: FONTS.mono,
                      fontSize: 12.5,
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                      color: isHighlighted ? COLORS.accentBright : COLORS.textSecondary,
                      background: isHighlighted ? COLORS.accentSubtle : COLORS.cardBg,
                      border: isHighlighted ? `1px solid ${COLORS.accentBorder}` : COLORS.border,
                      minWidth: 44,
                    }}
                  >
                    {`[${String(idx + 1).padStart(2, "0")}]`}
                  </span>

                  <div className="flex flex-col gap-0.5">
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 600,
                        color: COLORS.textPrimary,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {item.title}
                    </div>
                    {(item.source || item.url) && (
                      <div
                        className="flex items-center gap-3"
                        style={{
                          fontFamily: FONTS.mono,
                          fontSize: 13,
                          color: COLORS.textSecondary,
                        }}
                      >
                        {item.source && <span>{item.source}</span>}
                        {item.source && item.url && <span style={{ opacity: 0.4 }}>·</span>}
                        {item.url && <span style={{ color: COLORS.accent }}>{item.url}</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {item.year && (
                    <span
                      style={{
                        fontFamily: FONTS.mono,
                        fontSize: 12,
                        color: COLORS.textMuted,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {item.year}
                    </span>
                  )}
                  {item.tag && (
                    <span
                      className="px-2.5 py-1 uppercase"
                      style={{
                        borderRadius: 5,
                        fontFamily: FONTS.mono,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: "0.12em",
                        color: isHighlighted ? COLORS.accent : COLORS.textSecondary,
                        background: isHighlighted ? COLORS.accentSubtle : COLORS.cardBg,
                        border: isHighlighted ? `1px solid ${COLORS.accentBorder}` : COLORS.border,
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

        {/* Alt özet notu */}
        {footerNote && (
          <div
            className="mt-6 flex items-center gap-2.5 pt-4"
            style={{
              borderTop: COLORS.border,
              fontFamily: FONTS.mono,
              fontSize: 13.5,
              color: COLORS.textSecondary,
            }}
          >
            <span style={{ color: COLORS.accent }}>{">"}</span>
            <span>{footerNote}</span>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, GLASS_TOKENS, MOTION, secToFrames } from "../theme";
import { CadCorners, SpecularSweep } from "./CadFrame";
import { CodeWindow, type CodeWindowProps } from "./CodeWindow";
import { MediaWindow, type MediaWindowProps } from "./MediaWindow";
import { TerminalTrace, type TerminalTraceProps } from "./TerminalTrace";

export type SplitVisual =
  | ({ type: "code" } & Omit<CodeWindowProps, "embedded" | "caption">)
  | ({ type: "media" } & Omit<MediaWindowProps, "embedded" | "caption" | "beatDurationInFrames">)
  | ({ type: "terminal" } & Omit<TerminalTraceProps, "embedded" | "caption">);

export interface SplitMetric {
  /** Ana sonuç değeri (ör. "8 ms", "3NF", "99.98%") */
  value: string;
  /** İsteğe bağlı önceki değer — üstü çizili karşılaştırma (ör. "420 ms") */
  before?: string;
  /** Değişim yüzdesi veya rozeti (ör. "-98%", "O(log n)") */
  delta?: string;
  /** Metriğin altındaki teknik etiket */
  label: string;
}

export interface SplitPoint {
  title: string;
  detail?: string;
  tag?: string;
  highlighted?: boolean;
}

export interface SplitStageProps {
  /** %60 ana görsel bölmesi: `code` (CodeWindow v3) veya `media` (MediaWindow) */
  visual: SplitVisual;
  /** %40 bilgi paneli üst teknik kategori etiketi */
  eyebrow?: string;
  /** %40 bilgi paneli ana başlığı */
  title: string;
  /** Başlık altı kısa özet */
  subtitle?: string;
  /** Öne çıkan canlı mühendislik metriği (ör. 420ms -> 8ms) */
  metric?: SplitMetric;
  /** Yapılandırılmış teknik çıkarım maddeleri */
  points?: SplitPoint[];
  /** Panel altındaki monospace teknik not */
  footerNote?: string;
  /** `true` ise %40 bilgi panelini sola, %60 görsel pencereyi sağa alır (ritim kırıcı düzen) */
  reverse?: boolean;
  /** TimelineRenderer tarafından geçirilen sahne süresi (kare) */
  beatDurationInFrames?: number;
  startFrame?: number;
}

/**
 * SplitStage (v2.2 Kilitli Bileşen Havuzu — Asimetrik 60/40 Mühendislik Sahnesi)
 * Ortalanmış tek kart monotonluğunu kırar:
 * - %60 bölmede canlı kod (`CodeWindow` v3 — focusSteps/diff destekli) veya medya (`MediaWindow`),
 * - %40 bölmede canlı metrik (`420ms → 8ms`) ve yapılandırılmış teknik çıkarımlar.
 */
export const SplitStage: React.FC<SplitStageProps> = ({
  visual,
  eyebrow,
  title,
  subtitle,
  metric,
  points = [],
  footerNote,
  reverse = false,
  beatDurationInFrames = 120,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - startFrame);

  // Bilgi paneli görselden 0.10 sn sonra yay fiziğiyle yerine oturur
  const panelDelay = secToFrames(0.10, fps);
  const panelEntrance = spring({
    frame: Math.max(0, localFrame - panelDelay),
    fps,
    config: MOTION.editorial,
  });

  const metricPop = spring({
    frame: Math.max(0, localFrame - secToFrames(0.24, fps)),
    fps,
    config: MOTION.impact,
  });

  const footerEntrance = spring({
    frame: Math.max(0, localFrame - secToFrames(0.48, fps)),
    fps,
    config: MOTION.snap,
  });

  const visualPane = (
    <div style={{ flex: "0 0 58.5%", minWidth: 0 }}>
      {visual.type === "code" ? (
        <CodeWindow
          {...visual}
          embedded
          startFrame={visual.startFrame ?? startFrame}
        />
      ) : visual.type === "terminal" ? (
        <TerminalTrace
          {...visual}
          embedded
          startFrame={visual.startFrame ?? startFrame}
        />
      ) : (
        <MediaWindow
          {...visual}
          embedded
          mediaHeight={560}
          beatDurationInFrames={beatDurationInFrames}
          startFrame={visual.startFrame ?? startFrame}
        />
      )}
    </div>
  );

  const infoSlideOffset = reverse ? -24 : 24;

  const infoPane = (
    <div
      className="flex flex-col justify-center"
      style={{
        flex: "1 1 41.5%",
        minWidth: 0,
        opacity: interpolate(panelEntrance, [0, 0.6], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        transform: `translate3d(${interpolate(panelEntrance, [0, 1], [infoSlideOffset, 0])}px, 0, 0)`,
      }}
    >
      {/* Üst teknik kategori etiketi */}
      {eyebrow && (
        <div className="mb-4 flex items-center gap-2.5">
          <span style={{ width: 6, height: 6, background: COLORS.accent }} />
          <span
            className="uppercase tracking-[0.22em]"
            style={{
              fontFamily: FONTS.mono,
              fontSize: 12.5,
              fontWeight: 600,
              color: COLORS.accent,
            }}
          >
            {eyebrow}
          </span>
        </div>
      )}

      {/* Ana başlık */}
      <h2
        className="m-0 leading-[1.16]"
        style={{
          fontSize: 38,
          fontWeight: 600,
          letterSpacing: "-0.025em",
          color: COLORS.textBright,
        }}
      >
        {title}
      </h2>

      {subtitle && (
        <p
          className="m-0 mt-3.5"
          style={{
            fontSize: 18.5,
            lineHeight: 1.52,
            color: COLORS.textSecondary,
          }}
        >
          {subtitle}
        </p>
      )}

      {/* Canlı Hero Metrik Kutusu (ör. 420ms -> 8ms, -98%) */}
      {metric && (
        <div
          className="relative mt-6 px-6 py-5"
          style={{
            borderRadius: GLASS_TOKENS.borderRadius,
            background: COLORS.cardBg,
            backdropFilter: GLASS_TOKENS.blur,
            WebkitBackdropFilter: GLASS_TOKENS.blur,
            border: `1px solid ${COLORS.accentBorder}`,
            boxShadow: `0 18px 46px rgba(0, 0, 0, 0.62), 0 0 28px ${COLORS.accentGlow}`,
            opacity: interpolate(metricPop, [0, 0.55], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `scale(${interpolate(metricPop, [0, 1], [0.94, 1])})`,
            transformOrigin: "left center",
          }}
        >
          <CadCorners size={10} accent startFrame={startFrame + secToFrames(0.24, fps)} />
          <SpecularSweep startFrame={startFrame + secToFrames(0.24, fps)} />

          <div className="flex items-baseline justify-between gap-4">
            <div
              className="flex items-baseline gap-3.5"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {metric.before && (
                <>
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 24,
                      fontWeight: 500,
                      color: COLORS.textMuted,
                      textDecoration: "line-through",
                      textDecorationColor: COLORS.danger,
                    }}
                  >
                    {metric.before}
                  </span>
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 20,
                      color: COLORS.accent,
                    }}
                  >
                    →
                  </span>
                </>
              )}

              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 44,
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  color: COLORS.accentBright,
                  lineHeight: 1.05,
                }}
              >
                {metric.value}
              </span>
            </div>

            {metric.delta && (
              <span
                className="px-2.5 py-1"
                style={{
                  borderRadius: 6,
                  fontFamily: FONTS.mono,
                  fontSize: 13,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: COLORS.success,
                  background: COLORS.successSoft,
                  border: `1px solid ${COLORS.successBorder}`,
                }}
              >
                {metric.delta}
              </span>
            )}
          </div>

          <div
            className="mt-2.5 uppercase tracking-[0.18em]"
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11.5,
              fontWeight: 600,
              color: COLORS.textSecondary,
            }}
          >
            {metric.label}
          </div>
        </div>
      )}

      {/* Yapılandırılmış Teknik Çıkarım Maddeleri */}
      {points.length > 0 && (
        <div className="mt-6 flex flex-col gap-3">
          {points.map((pt, idx) => {
            const ptSpring = spring({
              frame: Math.max(0, localFrame - secToFrames(0.28 + idx * 0.10, fps)),
              fps,
              config: MOTION.editorial,
            });
            const isAccent = Boolean(pt.highlighted);

            return (
              <div
                key={`split-pt-${idx}`}
                className="relative flex items-start gap-3.5 px-4 py-3.5"
                style={{
                  borderRadius: GLASS_TOKENS.borderRadiusSm,
                  background: isAccent ? COLORS.accentSoft : COLORS.surfaceSubtle,
                  border: isAccent ? `1px solid ${COLORS.accentBorder}` : COLORS.border,
                  opacity: interpolate(ptSpring, [0, 0.65], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  }),
                  transform: `translate3d(0, ${interpolate(ptSpring, [0, 1], [12, 0])}px, 0)`,
                }}
              >
                <span
                  className="mt-2 shrink-0"
                  style={{
                    width: 6,
                    height: 6,
                    background: isAccent ? COLORS.accent : COLORS.textMuted,
                  }}
                />

                <div className="flex flex-1 flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      style={{
                        fontSize: 19,
                        fontWeight: isAccent ? 600 : 500,
                        color: isAccent ? COLORS.textBright : COLORS.textPrimary,
                        lineHeight: 1.35,
                      }}
                    >
                      {pt.title}
                    </span>

                    {pt.tag && (
                      <span
                        className="shrink-0 px-2 py-0.5 uppercase"
                        style={{
                          borderRadius: 5,
                          fontFamily: FONTS.mono,
                          fontSize: 10.5,
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
                        {pt.tag}
                      </span>
                    )}
                  </div>

                  {pt.detail && (
                    <span
                      style={{
                        fontSize: 15.5,
                        lineHeight: 1.45,
                        color: COLORS.textSecondary,
                      }}
                    >
                      {pt.detail}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Alt monospace teknik not */}
      {footerNote && (
        <div
          className="mt-5 flex items-center gap-2.5 px-4 py-2.5"
          style={{
            borderRadius: GLASS_TOKENS.borderRadiusSm,
            background: "rgba(255, 255, 255, 0.02)",
            border: COLORS.border,
            fontFamily: FONTS.mono,
            fontSize: 12.5,
            color: COLORS.textSecondary,
            opacity: interpolate(footerEntrance, [0, 0.7], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <span style={{ color: COLORS.accent }}>›</span>
          <span>{footerNote}</span>
        </div>
      )}
    </div>
  );

  return (
    <AbsoluteFill
      className="flex items-center justify-center px-16"
      style={{ fontFamily: FONTS.sans }}
    >
      <div
        className="flex w-full max-w-[1720px] items-center gap-12"
        style={{
          flexDirection: reverse ? "row-reverse" : "row",
        }}
      >
        {visualPane}
        {infoPane}
      </div>
    </AbsoluteFill>
  );
};

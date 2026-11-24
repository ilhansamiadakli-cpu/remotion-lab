import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, GLASS_TOKENS, MOTION, secToFrames } from "../theme";
import { CadCorners, SpecularSweep } from "./CadFrame";

export interface StepItem {
  /** Adım başlığı */
  title: string;
  /** İsteğe bağlı alt açıklama */
  detail?: string;
  /** İsteğe bağlı süre veya ölçü rozeti */
  duration?: string;
}

export interface StepCardProps {
  /** Kart başlığı */
  title?: string;
  /** Başlık üstündeki küçük monospace etiket */
  eyebrow?: string;
  /** Sağ üst rozet */
  badge?: string;
  /** Sıralı adımlar listesi */
  steps: Array<StepItem | string>;
  /** Belirli bir adımı sabitlemek için (verilmezse beat süresi boyunca otomatik ilerler) */
  activeStepIndex?: number;
  /** TimelineRenderer tarafından geçirilen sahne süresi (kare cinsinden) */
  beatDurationInFrames?: number;
  /** Kartın açılış başlangıç karesi */
  startFrame?: number;
}

function normalizeStep(step: StepItem | string): StepItem {
  if (typeof step === "string") {
    return { title: step };
  }
  return step;
}

/**
 * StepCard (FPS-Bağımsız `secToFrames` + CAD Köşe Nişangâhlı Adım Kartı)
 */
export const StepCard: React.FC<StepCardProps> = ({
  title = "Uygulama Adımları",
  eyebrow,
  badge,
  steps,
  activeStepIndex,
  beatDurationInFrames = 150,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const normalizedSteps = steps.map(normalizeStep);
  const totalSteps = Math.max(1, normalizedSteps.length);
  const localFrame = Math.max(0, frame - startFrame);

  const cardEntrance = spring({
    frame: localFrame,
    fps,
    config: MOTION.editorial,
  });

  // FPS-bağımsız oturma süresi (0.30 sn)
  const settleFrames = secToFrames(0.30, fps);
  const usableFrames = Math.max(totalSteps, beatDurationInFrames - settleFrames);
  const framesPerStep = usableFrames / totalSteps;

  const currentActiveIndex =
    typeof activeStepIndex === "number"
      ? Math.min(totalSteps - 1, Math.max(0, activeStepIndex))
      : Math.min(
          totalSteps - 1,
          Math.floor(Math.max(0, localFrame - settleFrames) / framesPerStep)
        );

  const activeStepStartFrame =
    typeof activeStepIndex === "number"
      ? startFrame + secToFrames(0.16, fps)
      : settleFrames + Math.round(currentActiveIndex * framesPerStep);

  return (
    <AbsoluteFill className="flex items-center justify-center px-20">
      <div
        className="relative w-full max-w-[980px]"
        style={{
          background: COLORS.glassBg,
          backdropFilter: GLASS_TOKENS.blur,
          WebkitBackdropFilter: GLASS_TOKENS.blur,
          border: COLORS.border,
          borderRadius: GLASS_TOKENS.borderRadius,
          boxShadow: `0 32px 84px rgba(0, 0, 0, 0.76), inset 0 1px 0 ${COLORS.borderHighlight}`,
          fontFamily: FONTS.sans,
          opacity: interpolate(cardEntrance, [0, 0.55], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          transform: `translate3d(0, ${interpolate(cardEntrance, [0, 1], [30, 0])}px, 0) scale(${interpolate(cardEntrance, [0, 1], [0.96, 1])})`,
        }}
      >
        <CadCorners size={14} accent startFrame={startFrame} />
        <SpecularSweep startFrame={startFrame} />

        {/* Kart Başlığı */}
        <div
          className="flex items-center justify-between px-9 py-7"
          style={{
            borderBottom: COLORS.border,
            background: "rgba(255, 255, 255, 0.016)",
          }}
        >
          <div className="flex flex-col gap-1.5">
            {eyebrow && (
              <span
                className="uppercase tracking-[0.2em]"
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  fontWeight: 500,
                  color: COLORS.accent,
                }}
              >
                {eyebrow}
              </span>
            )}
            <h2
              className="m-0 leading-tight"
              style={{
                fontSize: 32,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: COLORS.textPrimary,
              }}
            >
              {title}
            </h2>
          </div>

          <span
            className="px-3.5 py-1.5"
            style={{
              borderRadius: GLASS_TOKENS.borderRadiusSm,
              fontFamily: FONTS.mono,
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.accent,
              background: COLORS.accentSoft,
              border: `1px solid ${COLORS.accentBorder}`,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {badge ?? `ADIM ${currentActiveIndex + 1} / ${totalSteps}`}
          </span>
        </div>

        {/* Adımlar Listesi */}
        <div className="flex flex-col gap-3.5 p-8">
          {normalizedSteps.map((step, idx) => {
            const isActive = idx === currentActiveIndex;
            const isCompleted = idx < currentActiveIndex;

            const rowDelay = secToFrames(0.12 + idx * 0.09, fps);
            const rowEntrance = spring({
              frame: Math.max(0, localFrame - rowDelay),
              fps,
              config: MOTION.editorial,
            });

            const activeSpring = isActive
              ? spring({
                  frame: Math.max(0, localFrame - activeStepStartFrame),
                  fps,
                  config: MOTION.snap,
                })
              : 0;

            const rowScale = isActive
              ? interpolate(activeSpring, [0, 1], [0.992, 1.01])
              : 1;

            const baseOpacity = isActive ? 1 : isCompleted ? 0.72 : 0.45;

            return (
              <div
                key={`step-${idx}-${step.title}`}
                className="relative flex items-center justify-between overflow-hidden px-6 py-5"
                style={{
                  borderRadius: GLASS_TOKENS.borderRadiusSm + 2,
                  background: isActive ? COLORS.accentSoft : COLORS.surfaceSubtle,
                  border: isActive
                    ? `1px solid ${COLORS.accentBorder}`
                    : COLORS.border,
                  boxShadow: isActive
                    ? `0 14px 34px rgba(0, 0, 0, 0.48), 0 0 22px ${COLORS.accentGlow}`
                    : "none",
                  opacity:
                    interpolate(rowEntrance, [0, 0.65], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }) * baseOpacity,
                  transform: `translate3d(0, ${interpolate(rowEntrance, [0, 1], [16, 0])}px, 0) scale(${rowScale})`,
                }}
              >
                {/* Aktif adımın sol kenarında sıcak kehribar odak çubuğu */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 10,
                    bottom: 10,
                    width: 3.5,
                    background: COLORS.accent,
                    boxShadow: `0 0 12px ${COLORS.accent}`,
                    opacity: isActive ? activeSpring : 0,
                    transform: `scaleY(${isActive ? activeSpring : 0})`,
                    transformOrigin: "center center",
                  }}
                />

                <div className="flex items-center gap-5 pl-2">
                  {/* Sıra numarası veya tamamlandı işareti */}
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: GLASS_TOKENS.borderRadiusSm,
                      fontFamily: FONTS.mono,
                      fontSize: 15,
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                      color: isActive
                        ? COLORS.background
                        : isCompleted
                          ? COLORS.accent
                          : COLORS.textSecondary,
                      background: isActive
                        ? COLORS.accent
                        : isCompleted
                          ? COLORS.accentSoft
                          : "rgba(255, 255, 255, 0.04)",
                      border: isActive
                        ? `1px solid ${COLORS.accent}`
                        : isCompleted
                          ? `1px solid ${COLORS.accentBorder}`
                          : COLORS.border,
                    }}
                  >
                    {isCompleted ? "✓" : String(idx + 1).padStart(2, "0")}
                  </div>

                  {/* Adım başlığı ve detay */}
                  <div className="flex flex-col gap-1">
                    <span
                      style={{
                        fontSize: 24,
                        fontWeight: isActive ? 600 : 500,
                        letterSpacing: "-0.015em",
                        color: isActive ? COLORS.textBright : COLORS.textPrimary,
                      }}
                    >
                      {step.title}
                    </span>
                    {step.detail && (
                      <span
                        style={{
                          fontSize: 16,
                          color: isActive ? "#cbd5e1" : COLORS.textSecondary,
                        }}
                      >
                        {step.detail}
                      </span>
                    )}
                  </div>
                </div>

                {/* Sağdaki süre / durum etiketi */}
                <div className="flex items-center gap-3">
                  {step.duration && (
                    <span
                      className="px-3 py-1.5"
                      style={{
                        borderRadius: 6,
                        fontFamily: FONTS.mono,
                        fontSize: 13.5,
                        fontWeight: 600,
                        fontVariantNumeric: "tabular-nums",
                        color: isActive ? COLORS.accent : COLORS.textSecondary,
                        background: isActive
                          ? COLORS.accentSoft
                          : "rgba(255, 255, 255, 0.04)",
                        border: isActive
                          ? `1px solid ${COLORS.accentBorder}`
                          : COLORS.border,
                      }}
                    >
                      {step.duration}
                    </span>
                  )}

                  {isActive && (
                    <span
                      className="px-2.5 py-1 uppercase tracking-[0.14em]"
                      style={{
                        borderRadius: 6,
                        fontFamily: FONTS.mono,
                        fontSize: 11,
                        fontWeight: 600,
                        color: COLORS.accent,
                        background: COLORS.accentSoft,
                        border: `1px solid ${COLORS.accentBorder}`,
                      }}
                    >
                      Aktif
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

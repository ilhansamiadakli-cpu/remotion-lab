import React from "react";
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONTS, GLASS_TOKENS, MOTION, secToFrames, useActiveTheme } from "../theme";
import { CadCorners, SpecularSweep } from "./CadFrame";

export interface MemoryBlockSpec {
  /** Bellek bloğunun adı (ör. "BSP Tree", "Textures", "PVS", "Entities") */
  label: string;
  /** Toplam bellek çubuğundaki yüzdesel genişlik (ör. 18) */
  sizePct: number;
  /** Kısa etiket veya boyut bilgisi (ör. "640 KB") */
  tag?: string;
  /** `fragmentation` veya `comparison` modunda bu blok rastgele free() edilip boşluk bıraksın mı? */
  freed?: boolean;
  /** İmza vurgu rengiyle öne çıkar */
  accent?: boolean;
}

export interface MemoryBarSimProps {
  /** Üst monospace teknik kategori etiketi */
  eyebrow?: string;
  /** Ana başlık */
  title?: string;
  /** Sağ üst rozet */
  badge?: string;
  /** Simülasyon modu: doğrusal arena, parçalanmış heap veya ikili karşılaştırma */
  mode?: "arena" | "fragmentation" | "comparison";
  /** Toplam bellek kapasitesi etiketi (ör. "4 MB HUNK ARENA") */
  totalLabel?: string;
  /** Tahsis edilecek bellek blokları (verilmezse varsayılan 5 sistem bloğu kullanılır) */
  blocks?: MemoryBlockSpec[];
  /** Arena pointer'ının tek hamlede `offset = 0` sıfırlanacağı yerel saniye (verilmezse sahnenin %72'si) */
  resetAtSec?: number;
  /** Sıfırlama anında yumuşak `tick.wav` çalsın mı? (varsayılan: true) */
  playResetTick?: boolean;
  /** Alt özet teknik not */
  caption?: string;
  /** `SplitStage` içine gömüldüğünde `<AbsoluteFill>` sarmalayıcısını kaldırır */
  embedded?: boolean;
  /** TimelineRenderer tarafından geçirilen sahne süresi (kare) */
  beatDurationInFrames?: number;
  startFrame?: number;
}

const DEFAULT_BLOCKS: MemoryBlockSpec[] = [
  { label: "BSP Nodes", sizePct: 22, tag: "880 KB", accent: true },
  { label: "Textures", sizePct: 24, tag: "960 KB", freed: true },
  { label: "PVS Bits", sizePct: 14, tag: "560 KB" },
  { label: "Lightmaps", sizePct: 18, tag: "720 KB", freed: true },
  { label: "Entities", sizePct: 12, tag: "480 KB", accent: true },
];

/**
 * MemoryBarSim (v3.0 Prosedürel SVG Simülasyonu)
 * Bellek bloklarının (Arena / Hunk / Heap) kare kare doluşunu, `malloc/free` parçalanmasını
 * ve bölüm sonunda tek pointer sıfırlamasıyla (`offset = 0`) O(1) temizliği canlandırır.
 */
export const MemoryBarSim: React.FC<MemoryBarSimProps> = ({
  eyebrow = "DOĞRUSAL BELLEK SİMÜLASYONU",
  title = "Hunk Arena & Pointer Sıfırlama",
  badge = "O(1) ARENA",
  mode = "comparison",
  totalLabel = "4 MB RAM (0x000000 – 0x400000)",
  blocks = DEFAULT_BLOCKS,
  resetAtSec,
  playResetTick = true,
  caption,
  embedded = false,
  beatDurationInFrames = 135,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const theme = useActiveTheme();

  const localFrame = Math.max(0, frame - startFrame);
  const beatDurSec = Math.max(2.5, beatDurationInFrames / fps);
  const effectiveResetSec = resetAtSec ?? Number((beatDurSec * 0.72).toFixed(2));
  const resetFrame = secToFrames(effectiveResetSec, fps);
  const canReset = mode === "arena" || mode === "comparison";

  const entrance = spring({
    frame: localFrame,
    fps,
    config: MOTION.editorial,
  });

  const resetProgress =
    canReset && localFrame >= resetFrame
      ? spring({
          frame: localFrame - resetFrame,
          fps,
          config: MOTION.snap,
        })
      : 0;

  // Blok tahsis zamanlaması (ilk %62 içinde tüm bloklar sırayla dolsun)
  const allocStartFrame = secToFrames(0.28, fps);
  const allocWindowFrames = Math.max(
    secToFrames(0.9, fps),
    Math.min(resetFrame - secToFrames(0.35, fps), secToFrames(beatDurSec * 0.56, fps))
  );
  const stepFrames = Math.max(4, Math.floor(allocWindowFrames / Math.max(1, blocks.length)));

  // Normalize widths so they never overflow 96%
  const rawSum = blocks.reduce((acc, b) => acc + Math.max(4, b.sizePct), 0);
  const scaleFactor = rawSum > 94 ? 94 / rawSum : 1;

  interface ComputedBlock extends MemoryBlockSpec {
    xPct: number;
    wPct: number;
    reveal: number;
    freedProgress: number;
  }

  let cursorPct = 0;
  const computed: ComputedBlock[] = blocks.map((blk, idx) => {
    const wPct = Math.max(4, blk.sizePct) * scaleFactor;
    const xPct = cursorPct;
    cursorPct += wPct;

    const bStart = allocStartFrame + idx * stepFrames;
    const reveal = spring({
      frame: Math.max(0, localFrame - bStart),
      fps,
      config: MOTION.snap,
    });

    const freeStart = bStart + secToFrames(0.75, fps);
    const freedProgress =
      blk.freed && localFrame >= freeStart
        ? interpolate(localFrame, [freeStart, freeStart + secToFrames(0.35, fps)], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.cubic),
          })
        : 0;

    return {
      ...blk,
      xPct,
      wPct,
      reveal,
      freedProgress,
    };
  });

  // Canlı bump-pointer yüzdesi (sıfırlamada 0'a geri sarar)
  const allocatedPct = computed.reduce((acc, b) => acc + b.wPct * b.reveal, 0);
  const activePointerPct = allocatedPct * (1 - resetProgress);
  const pointerBytesHex = `0x${Math.round((activePointerPct / 100) * 0x400000)
    .toString(16)
    .toUpperCase()
    .padStart(6, "0")}`;

  const svgW = 1120;
  const svgH = mode === "comparison" ? 370 : 210;
  const barX = 44;
  const barW = svgW - 88;
  const barH = 74;

  const isResetDone = canReset && resetProgress > 0.35;

  const card = (
    <div
      className="relative flex w-full flex-col"
      style={{
        maxWidth: embedded ? undefined : 1260,
        background: COLORS.glassBg,
        backdropFilter: GLASS_TOKENS.blur,
        WebkitBackdropFilter: GLASS_TOKENS.blur,
        border: COLORS.border,
        borderRadius: GLASS_TOKENS.borderRadius,
        boxShadow: theme.isLight
          ? `0 24px 60px rgba(17, 24, 39, 0.12), inset 0 1px 0 ${COLORS.borderHighlight}`
          : `0 34px 86px rgba(0, 0, 0, 0.78), inset 0 1px 0 ${COLORS.borderHighlight}`,
        padding: embedded ? "22px 24px" : "30px 36px",
        opacity: interpolate(entrance, [0, 0.55], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        transform: `translate3d(0, ${interpolate(entrance, [0, 1], [22, 0])}px, 0) scale(${interpolate(entrance, [0, 1], [0.97, 1])})`,
      }}
    >
      <CadCorners size={13} accent startFrame={startFrame} />
      <SpecularSweep startFrame={startFrame} />

      {/* Sıfırlama anında hafif tick SFX */}
      {canReset && playResetTick && resetFrame > 0 && resetFrame < beatDurationInFrames - 2 && (
        <Sequence from={resetFrame} durationInFrames={secToFrames(0.35, fps)}>
          <Audio src={staticFile("sfx/tick.wav")} volume={0.14} />
        </Sequence>
      )}

      {/* Üst başlık ve canlı pointer durumu */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          {eyebrow && (
            <div className="flex items-center gap-2">
              <span style={{ width: 6, height: 6, background: COLORS.accent }} />
              <span
                className="uppercase tracking-[0.18em]"
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
          <h2
            className="m-0"
            style={{
              fontFamily: FONTS.sans,
              fontSize: embedded ? 26 : 32,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              color: COLORS.textPrimary,
            }}
          >
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {canReset && (
            <div
              className="px-3 py-1.5"
              style={{
                borderRadius: 6,
                fontFamily: FONTS.mono,
                fontSize: 12.5,
                fontWeight: 600,
                color: isResetDone ? COLORS.success : COLORS.accentBright,
                background: isResetDone ? COLORS.successSoft : COLORS.accentSoft,
                border: `1px solid ${isResetDone ? COLORS.successBorder : COLORS.accentBorder}`,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {isResetDone ? "OFFSET = 0x000000 · O(1) RESET" : `PTR = ${pointerBytesHex}`}
            </div>
          )}
          {badge && (
            <span
              className="px-3 py-1.5 uppercase"
              style={{
                borderRadius: 6,
                fontFamily: FONTS.mono,
                fontSize: 11.5,
                fontWeight: 600,
                letterSpacing: "0.14em",
                color: COLORS.textSecondary,
                background: COLORS.surfaceSubtle,
                border: COLORS.border,
              }}
            >
              {badge}
            </span>
          )}
        </div>
      </div>

      {/* Prosedürel SVG Bellek Çubuğu */}
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
      >
        <defs>
          <pattern
            id="mem-frag-hatch"
            width="10"
            height="10"
            patternTransform="rotate(45 0 0)"
            patternUnits="userSpaceOnUse"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="10"
              stroke={theme.colors.danger}
              strokeOpacity={0.35}
              strokeWidth="2"
            />
          </pattern>
        </defs>

        {/* --- 1. ÇUBUK: LINEAR ARENA / HUNK (veya yalnızca fragmentation modunda HEAP) --- */}
        {(mode === "arena" || mode === "comparison") && (() => {
          const yTop = 44;
          const ptrX = barX + (activePointerPct / 100) * barW;
          return (
            <g>
              <text
                x={barX}
                y={yTop - 16}
                fill={theme.colors.accent}
                fontFamily={FONTS.mono}
                fontSize={13}
                fontWeight={600}
                letterSpacing="0.12em"
              >
                {`[A] DOĞRUSAL HUNK ARENA  ·  ${totalLabel}`}
              </text>
              <text
                x={barX + barW}
                y={yTop - 16}
                textAnchor="end"
                fill={isResetDone ? theme.colors.success : theme.colors.textSecondary}
                fontFamily={FONTS.mono}
                fontSize={12.5}
                fontWeight={600}
              >
                {isResetDone
                  ? "TEMİZLENDİ: hunk_low_used = 0"
                  : `DOLULUK: ${Math.round(activePointerPct)}% · 0% PARÇALANMA`}
              </text>

              {/* Arka ray */}
              <rect
                x={barX}
                y={yTop}
                width={barW}
                height={barH}
                rx={8}
                fill={theme.colors.canvasDeep}
                stroke={isResetDone ? theme.colors.success : theme.colors.accentBorder}
                strokeWidth={1.5}
              />

              {/* Sıralı dolan bloklar */}
              {computed.map((blk, i) => {
                const bx = barX + (blk.xPct / 100) * barW + 3;
                const fullW = Math.max(0, (blk.wPct / 100) * barW - 6);
                const curW = fullW * blk.reveal * (1 - resetProgress);
                const fillAlpha = blk.accent ? 0.30 : 0.16;
                return (
                  <g key={`arena-${i}`} opacity={Math.max(0, (1 - resetProgress) * (blk.reveal > 0.02 ? 1 : 0))}>
                    <rect
                      x={bx}
                      y={yTop + 6}
                      width={Math.max(0, curW)}
                      height={barH - 12}
                      rx={5}
                      fill={`rgba(${theme.colors.accentRgb}, ${fillAlpha})`}
                      stroke={blk.accent ? theme.colors.accent : theme.colors.accentBorder}
                      strokeWidth={blk.accent ? 1.6 : 1}
                    />
                    {curW > 54 && (
                      <>
                        <text
                          x={bx + curW / 2}
                          y={yTop + 33}
                          textAnchor="middle"
                          fill={theme.colors.textBright}
                          fontFamily={FONTS.mono}
                          fontSize={13}
                          fontWeight={600}
                        >
                          {blk.label}
                        </text>
                        {blk.tag && (
                          <text
                            x={bx + curW / 2}
                            y={yTop + 52}
                            textAnchor="middle"
                            fill={theme.colors.textSecondary}
                            fontFamily={FONTS.mono}
                            fontSize={11}
                          >
                            {blk.tag}
                          </text>
                        )}
                      </>
                    )}
                  </g>
                );
              })}

              {/* Canlı Bump Pointer İmleci */}
              <g transform={`translate(${ptrX}, 0)`}>
                <line
                  x1={0}
                  y1={yTop - 4}
                  x2={0}
                  y2={yTop + barH + 14}
                  stroke={isResetDone ? theme.colors.success : theme.colors.accentBright}
                  strokeWidth={2.4}
                />
                <polygon
                  points={`0,${yTop + barH + 4} -7,${yTop + barH + 16} 7,${yTop + barH + 16}`}
                  fill={isResetDone ? theme.colors.success : theme.colors.accentBright}
                />
                <text
                  x={ptrX > barX + barW - 120 ? -10 : 10}
                  y={yTop + barH + 28}
                  textAnchor={ptrX > barX + barW - 120 ? "end" : "start"}
                  fill={isResetDone ? theme.colors.success : theme.colors.accentBright}
                  fontFamily={FONTS.mono}
                  fontSize={12}
                  fontWeight={600}
                >
                  {isResetDone ? "hunk_low = 0 (O(1))" : `bump_ptr → ${pointerBytesHex}`}
                </text>
              </g>
            </g>
          );
        })()}

        {/* --- 2. ÇUBUK: STANDART C MALLOC / FREE PARÇALANMA --- */}
        {(mode === "fragmentation" || mode === "comparison") && (() => {
          const yTop = mode === "comparison" ? 222 : 44;
          const wastedPct = Math.round(
            computed.reduce((acc, b) => acc + (b.freed ? b.wPct * b.freedProgress : 0), 0)
          );
          return (
            <g>
              <text
                x={barX}
                y={yTop - 16}
                fill={theme.colors.danger}
                fontFamily={FONTS.mono}
                fontSize={13}
                fontWeight={600}
                letterSpacing="0.12em"
              >
                [B] STANDART C HEAP (malloc / free)  ·  PARÇALANMA RİSKİ
              </text>
              <text
                x={barX + barW}
                y={yTop - 16}
                textAnchor="end"
                fill={wastedPct > 0 ? theme.colors.danger : theme.colors.textSecondary}
                fontFamily={FONTS.mono}
                fontSize={12.5}
                fontWeight={600}
              >
                {wastedPct > 0 ? `PARÇALI BOŞLUK: ~%${wastedPct} (FRAGMENTED)` : "HEAP TAHSİSİ..."}
              </text>

              <rect
                x={barX}
                y={yTop}
                width={barW}
                height={barH}
                rx={8}
                fill={theme.colors.canvasDeep}
                stroke={theme.colors.dangerBorder}
                strokeWidth={1.3}
              />

              {computed.map((blk, i) => {
                const bx = barX + (blk.xPct / 100) * barW + 3;
                const fullW = Math.max(0, (blk.wPct / 100) * barW - 6);
                const curW = fullW * blk.reveal;
                const isHole = blk.freed && blk.freedProgress > 0.35;

                return (
                  <g key={`heap-${i}`} opacity={blk.reveal > 0.02 ? 1 : 0}>
                    <rect
                      x={bx}
                      y={yTop + 6}
                      width={Math.max(0, curW)}
                      height={barH - 12}
                      rx={5}
                      fill={isHole ? "url(#mem-frag-hatch)" : theme.colors.surfaceSubtle}
                      stroke={isHole ? theme.colors.danger : theme.colors.borderColor}
                      strokeDasharray={isHole ? "5 4" : undefined}
                      strokeWidth={isHole ? 1.5 : 1}
                    />
                    {curW > 54 && (
                      <>
                        <text
                          x={bx + curW / 2}
                          y={yTop + 33}
                          textAnchor="middle"
                          fill={isHole ? theme.colors.danger : theme.colors.textSecondary}
                          fontFamily={FONTS.mono}
                          fontSize={12.5}
                          fontWeight={600}
                        >
                          {isHole ? "FREE HOLE" : blk.label}
                        </text>
                        <text
                          x={bx + curW / 2}
                          y={yTop + 52}
                          textAnchor="middle"
                          fill={isHole ? theme.colors.danger : theme.colors.textMuted}
                          fontFamily={FONTS.mono}
                          fontSize={11}
                        >
                          {isHole ? "Sığmaz / Delik" : blk.tag ?? "heap"}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}

              {/* Adres cetveli */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const tx = barX + ratio * barW;
                const addr = `0x${Math.round(ratio * 0x400000)
                  .toString(16)
                  .toUpperCase()
                  .padStart(6, "0")}`;
                return (
                  <text
                    key={addr}
                    x={tx}
                    y={yTop + barH + 24}
                    textAnchor={ratio === 0 ? "start" : ratio === 1 ? "end" : "middle"}
                    fill={theme.colors.textMuted}
                    fontFamily={FONTS.mono}
                    fontSize={11}
                  >
                    {addr}
                  </text>
                );
              })}
            </g>
          );
        })()}
      </svg>
    </div>
  );

  if (embedded) {
    return card;
  }

  return (
    <AbsoluteFill
      className="flex flex-col items-center justify-center px-24"
      style={{ fontFamily: FONTS.sans }}
    >
      {card}
      {caption && (
        <div
          className="mt-6 flex items-center gap-3 px-6 py-3"
          style={{
            borderRadius: GLASS_TOKENS.borderRadiusSm,
            background: COLORS.cardBg,
            backdropFilter: GLASS_TOKENS.blur,
            WebkitBackdropFilter: GLASS_TOKENS.blur,
            border: COLORS.border,
          }}
        >
          <span style={{ width: 6, height: 6, background: COLORS.accent }} />
          <span style={{ fontFamily: FONTS.mono, fontSize: 14.5, color: COLORS.textSecondary }}>
            {caption}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};

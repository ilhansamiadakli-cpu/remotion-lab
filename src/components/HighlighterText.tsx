import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, GLASS_TOKENS, MOTION, secToFrames } from "../theme";
import { CadCorners, SpecularSweep } from "./CadFrame";

export interface HighlighterTextProps {
  /** Ana cümle */
  text?: string;
  /** Arkasından soldan sağa kehribar fosforlu vurgu bandı akacak kilit kelimeler/ifadeler */
  highlights?: string[];
  /** Üstteki küçük teknik kategori etiketi */
  eyebrow?: string;
  /** Cümle altındaki ikincil açıklama */
  caption?: string;
  /** İlk vurgu bandının başlayacağı yerel kare (verilmezse 0.30 sn) */
  startFrame?: number;
  /** Birden fazla vurgu arasındaki gecikme karesi (verilmezse 0.40 sn) */
  staggerFrames?: number;
  /**
   * Kelime zaman damgalı senkron: Her bir highlight ifadesinin beat içi başlangıç saniyesi
   * (ör. `[0.55, 1.85]`). Verilirse `startFrame` / `staggerFrames` yerine tam saniyesinde tetiklenir.
   */
  highlightAtSecs?: number[];
  /** `true` ise kart çerçevesi olmadan doğrudan Obsidian boşluğu üstünde saf tipografi sunar */
  frameless?: boolean;
  /** Doğrudan alt eleman geçmek için */
  children?: React.ReactNode;
  /** Kartsız, yalnızca satır içi vurgu bandı modu */
  inline?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

interface TextSegment {
  content: string;
  highlighted: boolean;
  highlightOrder: number;
}

function segmentTextByHighlights(text: string, highlights?: string[]): TextSegment[] {
  const cleanHighlights = (highlights ?? [])
    .map((h) => h.trim())
    .filter((h) => h.length > 0);

  if (cleanHighlights.length === 0) {
    return [{ content: text, highlighted: true, highlightOrder: 0 }];
  }

  const escaped = cleanHighlights
    .slice()
    .sort((a, b) => b.length - a.length)
    .map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex).filter((p) => p.length > 0);

  let order = 0;
  return parts.map((part) => {
    const isMatch = cleanHighlights.some(
      (h) => h.toLocaleLowerCase("tr-TR") === part.toLocaleLowerCase("tr-TR")
    );
    if (isMatch) {
      return { content: part, highlighted: true, highlightOrder: order++ };
    }
    return { content: part, highlighted: false, highlightOrder: -1 };
  });
}

const InlineHighlightBand: React.FC<{
  children: React.ReactNode;
  startFrame: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ children, startFrame, className = "", style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - startFrame);

  const sweepProgress = spring({
    frame: localFrame,
    fps,
    config: MOTION.editorial,
  });

  const scaleX = interpolate(sweepProgress, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const leadingGlowOpacity = interpolate(
    sweepProgress,
    [0, 0.14, 0.82, 1],
    [0, 0.95, 0.65, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  return (
    <span
      className={`relative inline-block px-2 py-0.5 ${className}`}
      style={{
        borderRadius: 6,
        ...style,
      }}
    >
      {/* Metnin arkasından soldan sağa akan sıcak kehribar vurgu bandı */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: "3px 0",
          zIndex: 0,
          borderRadius: 6,
          background: `linear-gradient(90deg, ${COLORS.accentHighlighterStart} 0%, ${COLORS.accentHighlighter} 72%, ${COLORS.accentHighlighterEnd} 100%)`,
          borderBottom: `2px solid ${COLORS.accent}`,
          boxShadow: `0 6px 20px ${COLORS.accentGlow}`,
          transform: `scaleX(${scaleX})`,
          transformOrigin: "left center",
        }}
      />

      {/* Hareketli kehribar ışık ucu */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 4,
          bottom: 4,
          left: `${scaleX * 100}%`,
          width: 2.5,
          zIndex: 1,
          background: COLORS.accentBright,
          boxShadow: `0 0 10px ${COLORS.accent}`,
          opacity: leadingGlowOpacity,
          transform: "translateX(-1.25px)",
        }}
      />

      <span
        style={{
          position: "relative",
          zIndex: 2,
          color: COLORS.textBright,
        }}
      >
        {children}
      </span>
    </span>
  );
};

/**
 * HighlighterText (Kişisel İmza — CAD Çerçeveli veya Kartsız Frameless Tipografi)
 * `frameless: true` ile kutusuz, doğrudan Obsidian negatif boşluğu üzerinde editoryal vurgu sunar.
 */
export const HighlighterText: React.FC<HighlighterTextProps> = ({
  text,
  highlights,
  eyebrow,
  caption,
  startFrame,
  staggerFrames,
  highlightAtSecs,
  frameless = false,
  children,
  inline = false,
  className = "",
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // FPS-bağımsız varsayılan zamanlamalar (30fps ve 60fps'de aynı saniye)
  const resolvedStartFrame = startFrame ?? secToFrames(0.32, fps);
  const resolvedStaggerFrames = staggerFrames ?? secToFrames(0.42, fps);

  if (inline) {
    return (
      <InlineHighlightBand
        startFrame={resolvedStartFrame}
        className={className}
        style={style}
      >
        {children ?? text}
      </InlineHighlightBand>
    );
  }

  const entrance = spring({
    frame,
    fps,
    config: MOTION.editorial,
  });

  const badgePop = spring({
    frame: Math.max(0, frame - secToFrames(0.1, fps)),
    fps,
    config: MOTION.snap,
  });

  const captionEntrance = spring({
    frame: Math.max(0, frame - (resolvedStartFrame + secToFrames(0.42, fps))),
    fps,
    config: MOTION.editorial,
  });

  const translateY = interpolate(entrance, [0, 1], [28, 0]);
  const scale = interpolate(entrance, [0, 1], [0.97, 1]);
  const opacity = interpolate(entrance, [0, 0.55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opticalBlur = frameless
    ? interpolate(entrance, [0, 0.65], [3.5, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;

  const displayText = text ?? (typeof children === "string" ? children : "");
  const segments = segmentTextByHighlights(displayText, highlights);

  const innerContent = (
    <>
      {eyebrow && (
        <div
          className="mb-8 flex items-center gap-2.5 px-3.5 py-1.5"
          style={{
            borderRadius: GLASS_TOKENS.borderRadiusSm,
            background: frameless ? "transparent" : COLORS.accentSoft,
            border: frameless
              ? `1px solid ${COLORS.borderColor}`
              : `1px solid ${COLORS.accentBorder}`,
            opacity: interpolate(badgePop, [0, 0.7], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `scale(${interpolate(badgePop, [0, 1], [0.9, 1])})`,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              background: COLORS.accent,
            }}
          />
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

      <div
        style={{
          fontSize: frameless ? 56 : 48,
          fontWeight: 600,
          lineHeight: 1.46,
          letterSpacing: "-0.028em",
          color: COLORS.textPrimary,
          maxWidth: frameless ? 1320 : 1180,
        }}
      >
        {displayText
          ? segments.map((seg, idx) =>
              seg.highlighted ? (
                <InlineHighlightBand
                  key={`${idx}-${seg.content}`}
                  startFrame={
                    typeof highlightAtSecs?.[seg.highlightOrder] === "number"
                      ? secToFrames(highlightAtSecs[seg.highlightOrder], fps)
                      : resolvedStartFrame + seg.highlightOrder * resolvedStaggerFrames
                  }
                >
                  {seg.content}
                </InlineHighlightBand>
              ) : (
                <React.Fragment key={`${idx}-${seg.content}`}>
                  {seg.content}
                </React.Fragment>
              )
            )
          : children}
      </div>

      {caption && (
        <p
          className="mt-8 max-w-2xl"
          style={{
            fontSize: 21,
            fontWeight: 400,
            lineHeight: 1.55,
            color: COLORS.textSecondary,
            opacity: interpolate(captionEntrance, [0, 0.7], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translate3d(0, ${interpolate(captionEntrance, [0, 1], [12, 0])}px, 0)`,
          }}
        >
          {caption}
        </p>
      )}
    </>
  );

  // Kartsız (Frameless) saf editoryal tipografi modu
  if (frameless) {
    return (
      <AbsoluteFill className="flex items-center justify-center px-28">
        <div
          className={`relative flex w-full max-w-[1440px] flex-col items-center text-center ${className}`}
          style={{
            fontFamily: FONTS.sans,
            opacity,
            transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
            filter: opticalBlur > 0.05 ? `blur(${opticalBlur}px)` : undefined,
            ...style,
          }}
        >
          {innerContent}
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill className="flex items-center justify-center px-24">
      <div
        className={`relative flex w-full max-w-[1360px] flex-col items-center text-center ${className}`}
        style={{
          padding: "60px 76px",
          background: COLORS.cardBg,
          backdropFilter: GLASS_TOKENS.blur,
          WebkitBackdropFilter: GLASS_TOKENS.blur,
          border: COLORS.border,
          borderRadius: GLASS_TOKENS.borderRadius,
          boxShadow: `0 32px 84px rgba(0, 0, 0, 0.76), inset 0 1px 0 ${COLORS.borderHighlight}`,
          fontFamily: FONTS.sans,
          opacity,
          transform: `translate3d(0, ${translateY}px, 0) scale(${scale})`,
          ...style,
        }}
      >
        <CadCorners size={14} accent />
        <SpecularSweep />
        {innerContent}
      </div>
    </AbsoluteFill>
  );
};

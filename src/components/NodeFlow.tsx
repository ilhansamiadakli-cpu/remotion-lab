import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, FONTS, GLASS_TOKENS, MOTION, secToFrames } from "../theme";
import { CadCorners, SpecularSweep } from "./CadFrame";
import { DashedConnector } from "./DashedConnector";

export interface FlowNode {
  /** Kutunun ana metni (ör. "93°C Su") */
  label: string;
  /** Altındaki açıklayıcı ikincil satır */
  sublabel?: string;
  /** Sol üst mini monospace rozet */
  badge?: string;
  /** Kutuyu imza kehribar rengiyle öne çıkar */
  highlighted?: boolean;
}

export interface NodeFlowProps {
  /** Sahne üst başlığı */
  title?: string;
  /** Başlık üstündeki küçük monospace kategori etiketi */
  eyebrow?: string;
  /** 2 veya 3 kavram kutusu */
  nodes: Array<FlowNode | string>;
  /** Bağlantı okları üzerindeki isteğe bağlı etiketler */
  edgeLabels?: string[];
  /** Alt özet notu */
  caption?: string;
  /** İlk kutunun başlangıç karesi (verilmezse 0.10 sn) */
  startFrame?: number;
}

interface NodeBoxLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

function computeNodeLayouts(count: number): NodeBoxLayout[] {
  if (count <= 2) {
    const width = 470;
    const height = 228;
    return [
      { x: 240, y: 404, width, height },
      { x: 1210, y: 472, width, height },
    ].slice(0, count);
  }

  const width = 390;
  const height = 220;
  return [
    { x: 165, y: 406, width, height },
    { x: 765, y: 476, width, height },
    { x: 1365, y: 406, width, height },
  ];
}

function normalizeNode(node: FlowNode | string, index: number): FlowNode {
  if (typeof node === "string") {
    return {
      label: node,
      badge: String(index + 1).padStart(2, "0"),
    };
  }
  return {
    badge: node.badge ?? String(index + 1).padStart(2, "0"),
    ...node,
  };
}

/**
 * NodeFlow (FPS-Bağımsız `secToFrames` + CAD Köşe Nişangâhlı Akış Diyagramı)
 * 2 veya 3 kavram kutusunu `DashedConnector` üzerinden akan noktalı Bezier oklarıyla bağlar.
 */
export const NodeFlow: React.FC<NodeFlowProps> = ({
  title,
  eyebrow,
  nodes,
  edgeLabels = [],
  caption,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const normalizedNodes = nodes.slice(0, 3).map(normalizeNode);
  const layouts = computeNodeLayouts(normalizedNodes.length);

  const headerEntrance = spring({
    frame,
    fps,
    config: MOTION.editorial,
  });

  // FPS-bağımsız kademeli zamanlama (30fps ve 60fps'de aynı saniye ritmi — 3sn beat'te bile caption görünür!)
  const baseStart = startFrame ?? secToFrames(0.10, fps);
  const nodeStepFrames = secToFrames(0.45, fps);
  const edgeOffsetFrames = secToFrames(0.24, fps);

  const nodeStartFrame = (idx: number) => baseStart + idx * nodeStepFrames;
  const connectorStartFrame = (idx: number) => nodeStartFrame(idx) + edgeOffsetFrames;

  const captionStart =
    nodeStartFrame(Math.max(0, normalizedNodes.length - 1)) + secToFrames(0.32, fps);
  const captionEntrance = spring({
    frame: Math.max(0, frame - captionStart),
    fps,
    config: MOTION.editorial,
  });

  return (
    <AbsoluteFill style={{ fontFamily: FONTS.sans }}>
      {/* Üst başlık bloğu */}
      {(eyebrow || title) && (
        <div
          className="absolute left-0 right-0 flex flex-col items-center text-center"
          style={{
            top: 132,
            opacity: interpolate(headerEntrance, [0, 0.65], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translate3d(0, ${interpolate(headerEntrance, [0, 1], [20, 0])}px, 0)`,
          }}
        >
          {eyebrow && (
            <div
              className="mb-4 flex items-center gap-2 px-3.5 py-1.5"
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

      {/* Kavram kutularını birbirine bağlayan noktalı kıvrımlı SVG Bezier okları */}
      {layouts.slice(0, -1).map((fromBox, idx) => {
        const toBox = layouts[idx + 1];
        return (
          <DashedConnector
            key={`edge-${idx}`}
            from={{
              x: fromBox.x + fromBox.width,
              y: fromBox.y + fromBox.height / 2,
            }}
            to={{
              x: toBox.x,
              y: toBox.y + toBox.height / 2,
            }}
            startFrame={connectorStartFrame(idx)}
            label={edgeLabels[idx]}
            curvature={0.52}
          />
        );
      })}

      {/* 2 veya 3 Kavram Kutusu */}
      {normalizedNodes.map((node, idx) => {
        const box = layouts[idx];
        const nStart = nodeStartFrame(idx);
        const localFrame = Math.max(0, frame - nStart);

        const cardSpring = spring({
          frame: localFrame,
          fps,
          config: MOTION.editorial,
        });

        const badgeSpring = spring({
          frame: Math.max(0, localFrame - secToFrames(0.1, fps)),
          fps,
          config: MOTION.snap,
        });

        const isLastOrHighlighted =
          node.highlighted ?? idx === normalizedNodes.length - 1;

        return (
          <div
            key={`node-${idx}-${node.label}`}
            className="absolute flex flex-col justify-between p-7"
            style={{
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
              background: COLORS.glassBg,
              backdropFilter: GLASS_TOKENS.blur,
              WebkitBackdropFilter: GLASS_TOKENS.blur,
              border: isLastOrHighlighted
                ? `1px solid ${COLORS.accentBorder}`
                : COLORS.border,
              borderRadius: GLASS_TOKENS.borderRadius,
              boxShadow: isLastOrHighlighted
                ? `0 28px 68px rgba(0, 0, 0, 0.74), 0 0 32px ${COLORS.accentGlow}, inset 0 1px 0 ${COLORS.borderHighlight}`
                : `0 24px 60px rgba(0, 0, 0, 0.70), inset 0 1px 0 ${COLORS.borderHighlight}`,
              opacity: interpolate(cardSpring, [0, 0.55], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              transform: `translate3d(0, ${interpolate(cardSpring, [0, 1], [28, 0])}px, 0) scale(${interpolate(cardSpring, [0, 1], [0.95, 1])})`,
            }}
          >
            <CadCorners
              size={10}
              accent={isLastOrHighlighted}
              startFrame={nStart}
            />
            {isLastOrHighlighted && <SpecularSweep startFrame={nStart} />}

            {/* Üst rozet ve durum göstergesi */}
            <div className="flex items-center justify-between">
              <span
                className="px-2.5 py-1"
                style={{
                  borderRadius: 6,
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  fontWeight: 600,
                  color: COLORS.accent,
                  background: COLORS.accentSoft,
                  border: `1px solid ${COLORS.accentBorder}`,
                  fontVariantNumeric: "tabular-nums",
                  transform: `scale(${interpolate(badgeSpring, [0, 1], [0.86, 1])})`,
                }}
              >
                {node.badge}
              </span>

              <span
                style={{
                  width: 6,
                  height: 6,
                  background: isLastOrHighlighted ? COLORS.accent : COLORS.textMuted,
                }}
              />
            </div>

            {/* Ana kavram metni ve alt bilgi */}
            <div className="flex flex-col gap-2">
              <div
                style={{
                  fontSize: 31,
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                  color: COLORS.textPrimary,
                  lineHeight: 1.18,
                }}
              >
                {node.label}
              </div>

              {node.sublabel && (
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 13.5,
                    color: COLORS.textSecondary,
                  }}
                >
                  {node.sublabel}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Alt özet notu */}
      {caption && (
        <div
          className="absolute left-1/2 flex items-center gap-3 px-6 py-3"
          style={{
            bottom: 112,
            borderRadius: GLASS_TOKENS.borderRadiusSm,
            transform: `translate(-50%, ${interpolate(captionEntrance, [0, 1], [16, 0])}px)`,
            opacity: interpolate(captionEntrance, [0, 0.7], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            background: COLORS.cardBg,
            backdropFilter: GLASS_TOKENS.blur,
            WebkitBackdropFilter: GLASS_TOKENS.blur,
            border: COLORS.border,
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

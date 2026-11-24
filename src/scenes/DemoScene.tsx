import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DotMatrixBg } from "../backgrounds";
import { DashedConnector } from "../components/DashedConnector";
import { GlassCard } from "../components/GlassCard";
import { HighlighterText } from "../components/HighlighterText";
import {
  COLORS,
  FONTS,
  GLASS_TOKENS,
  SPRING_FAST,
  SPRING_SMOOTH,
} from "../theme";

interface SchemaRow {
  name: string;
  type: string;
  tag?: "PK" | "FK" | "UNIQUE" | "CHECK";
  highlighted?: boolean;
}

const ODA_FIELDS: SchemaRow[] = [
  { name: "OdaID", type: "INT", tag: "PK", highlighted: true },
  { name: "OdaNo", type: "VARCHAR(10)", tag: "UNIQUE" },
  { name: "Kat", type: "SMALLINT" },
  { name: "Tip", type: "ENUM('Standart', 'Suit')" },
  { name: "AktifMi", type: "BOOLEAN" },
];

const REZERVASYON_FIELDS: SchemaRow[] = [
  { name: "RezervasyonID", type: "INT", tag: "PK" },
  { name: "OdaID", type: "INT", tag: "FK", highlighted: true },
  { name: "GirisTarihi", type: "DATE" },
  { name: "CikisTarihi", type: "DATE" },
  { name: "TarihKuralı", type: "Giris < Cikis", tag: "CHECK" },
];

const LAYOUT = {
  cardTop: 310,
  cardWidth: 480,
  odaLeft: 190,
  rezervasyonLeft: 1250,
  headerHeight: 92,
  bodyPaddingTop: 24,
  rowHeight: 56,
  rowGap: 10,
} as const;

const getRowCenterY = (rowIndex: number) =>
  LAYOUT.cardTop +
  GLASS_TOKENS.borderWidth +
  LAYOUT.headerHeight +
  LAYOUT.bodyPaddingTop +
  rowIndex * (LAYOUT.rowHeight + LAYOUT.rowGap) +
  LAYOUT.rowHeight / 2;

const TIMELINE = {
  highlightStart: 28,
  transitionStart: 180,
  odaCardStart: 196,
  rezervasyonCardStart: 222,
  connectorStart: 256,
  constraintFooterStart: 345,
} as const;

const SchemaRowItem: React.FC<{ row: SchemaRow }> = ({ row }) => {
  const isAccent = Boolean(row.highlighted);

  return (
    <div
      className="flex items-center justify-between rounded-xl px-4"
      style={{
        height: LAYOUT.rowHeight,
        background: isAccent ? COLORS.accentSoft : COLORS.surfaceSubtle,
        border: isAccent ? `1px solid ${COLORS.accentBorder}` : COLORS.border,
        boxShadow: isAccent ? `0 0 22px rgba(56, 189, 248, 0.14)` : "none",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: isAccent ? COLORS.accent : COLORS.textMuted,
            boxShadow: isAccent ? `0 0 10px ${COLORS.accent}` : "none",
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
          {row.name}
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 13,
            color: COLORS.textSecondary,
          }}
        >
          {row.type}
        </span>

        {row.tag && (
          <span
            className="rounded-md px-2 py-0.5"
            style={{
              fontFamily: FONTS.mono,
              fontSize: 11,
              fontWeight: 600,
              color: isAccent ? COLORS.accent : COLORS.textSecondary,
              background: isAccent
                ? "rgba(56, 189, 248, 0.2)"
                : "rgba(255, 255, 255, 0.06)",
              border: isAccent
                ? `1px solid ${COLORS.accentBorder}`
                : COLORS.border,
            }}
          >
            {row.tag}
          </span>
        )}
      </div>
    </div>
  );
};

export const DemoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const transitionSpring = spring({
    frame: Math.max(0, frame - TIMELINE.transitionStart),
    fps,
    config: SPRING_SMOOTH,
  });

  const bgBlur = interpolate(transitionSpring, [0, 1], [0, 6]);
  const bgDimOpacity = interpolate(transitionSpring, [0, 1], [1, 0.62]);

  const introSpring = spring({
    frame,
    fps,
    config: SPRING_SMOOTH,
  });

  const introFadeIn = interpolate(introSpring, [0, 0.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const introTranslateY = interpolate(introSpring, [0, 1], [22, 0]);

  const ruleY = interpolate(transitionSpring, [0, 1], [0, -372]);
  const ruleScale = interpolate(transitionSpring, [0, 1], [1, 0.72]);
  const subtitleOpacity = interpolate(transitionSpring, [0, 0.45], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const footerEntrance = spring({
    frame: Math.max(0, frame - TIMELINE.constraintFooterStart),
    fps,
    config: SPRING_FAST,
  });

  const connectorFrom = {
    x: LAYOUT.odaLeft + LAYOUT.cardWidth,
    y: getRowCenterY(0),
  };
  const connectorTo = {
    x: LAYOUT.rezervasyonLeft,
    y: getRowCenterY(1),
  };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.background,
        fontFamily: FONTS.sans,
        overflow: "hidden",
      }}
    >
      <DotMatrixBg blurPx={bgBlur} dimOpacity={bgDimOpacity} />

      <AbsoluteFill className="flex flex-col items-center justify-center">
        <div
          className="flex flex-col items-center text-center"
          style={{
            opacity: introFadeIn,
            transform: `translate3d(0, ${introTranslateY + ruleY}px, 0) scale(${ruleScale})`,
          }}
        >
          <div
            className="mb-5 flex items-center gap-2.5 rounded-full px-4 py-1.5"
            style={{
              background: COLORS.accentSoft,
              border: `1px solid ${COLORS.accentBorder}`,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: COLORS.accent,
                boxShadow: `0 0 10px ${COLORS.accent}`,
              }}
            />
            <span
              className="uppercase tracking-[0.2em]"
              style={{
                fontFamily: FONTS.mono,
                fontSize: 13,
                fontWeight: 600,
                color: COLORS.accent,
              }}
            >
              İş Kuralı · Veri Bütünlüğü
            </span>
          </div>

          <div
            style={{
              fontSize: 44,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              color: COLORS.textPrimary,
            }}
          >
            <HighlighterText
              inline
              startFrame={TIMELINE.highlightStart}
              className="whitespace-nowrap"
            >
              Aynı odanın çakışan tarihlerde rezerve edilmesi engellenir
            </HighlighterText>
          </div>

          <p
            className="mt-6 max-w-2xl"
            style={{
              fontSize: 20,
              color: COLORS.textSecondary,
              opacity: subtitleOpacity,
              lineHeight: 1.5,
            }}
          >
            İlişkisel şema düzeyinde{" "}
            <span style={{ fontFamily: FONTS.mono, color: COLORS.accent }}>Oda</span>{" "}
            ve{" "}
            <span style={{ fontFamily: FONTS.mono, color: COLORS.accent }}>
              Rezervasyon
            </span>{" "}
            varlıkları tekil yabancı anahtar akışıyla bağlanır.
          </p>
        </div>
      </AbsoluteFill>

      {frame >= TIMELINE.transitionStart && (
        <AbsoluteFill>
          <GlassCard
            centered={false}
            title="Oda"
            subtitle="TABLO · KAYNAK VARLIK"
            badge="1 : N"
            startFrame={TIMELINE.odaCardStart}
            width={LAYOUT.cardWidth}
            style={{
              position: "absolute",
              left: LAYOUT.odaLeft,
              top: LAYOUT.cardTop,
            }}
          >
            <div className="flex flex-col" style={{ gap: LAYOUT.rowGap }}>
              {ODA_FIELDS.map((row) => (
                <SchemaRowItem key={row.name} row={row} />
              ))}
            </div>
          </GlassCard>

          <GlassCard
            centered={false}
            title="Rezervasyon"
            subtitle="TABLO · HEDEF VARLIK"
            badge="FK KISITI"
            startFrame={TIMELINE.rezervasyonCardStart}
            width={LAYOUT.cardWidth}
            style={{
              position: "absolute",
              left: LAYOUT.rezervasyonLeft,
              top: LAYOUT.cardTop,
            }}
          >
            <div className="flex flex-col" style={{ gap: LAYOUT.rowGap }}>
              {REZERVASYON_FIELDS.map((row) => (
                <SchemaRowItem key={row.name} row={row} />
              ))}
            </div>
          </GlassCard>

          <DashedConnector
            from={connectorFrom}
            to={connectorTo}
            startFrame={TIMELINE.connectorStart}
            label="FK: OdaID"
          />

          <div
            className="absolute left-1/2 flex items-center gap-3 rounded-2xl px-6 py-3.5"
            style={{
              bottom: 112,
              transform: `translate(-50%, ${interpolate(footerEntrance, [0, 1], [20, 0])}px)`,
              opacity: interpolate(footerEntrance, [0, 0.7], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              background: COLORS.glassBg,
              backdropFilter: GLASS_TOKENS.blur,
              WebkitBackdropFilter: GLASS_TOKENS.blur,
              border: COLORS.border,
            }}
          >
            <span
              className="rounded-md px-2.5 py-1"
              style={{
                fontFamily: FONTS.mono,
                fontSize: 12,
                fontWeight: 600,
                color: COLORS.accent,
                background: COLORS.accentSoft,
                border: `1px solid ${COLORS.accentBorder}`,
              }}
            >
              CONSTRAINT
            </span>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 15,
                color: COLORS.textSecondary,
              }}
            >
              EXCLUDE USING gist (
              <span style={{ color: COLORS.textPrimary }}>OdaID</span> WITH =,
              daterange(
              <span style={{ color: COLORS.textPrimary }}>GirisTarihi</span>,{" "}
              <span style={{ color: COLORS.textPrimary }}>CikisTarihi</span>) WITH
              &amp;&amp;)
            </span>
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

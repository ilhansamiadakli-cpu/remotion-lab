import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, FONTS, GLASS_TOKENS, MOTION, secToFrames } from "../theme";
import { CadCorners, SpecularSweep } from "./CadFrame";

export type CodeLanguage = "sql" | "bash" | "java";

export interface CodeFocusStep {
  /** Odak değişiminin başlayacağı yerel saniye (beat içi) */
  atSec: number;
  /** Vurgulanacak 1-tabanlı satır numaraları */
  lines: number[];
  /** Bu odak adımına geçildiğinde alt şeritte gösterilecek dinamik açıklama */
  caption?: string;
}

export interface CodeDiffLines {
  /** Kaldırılan / eski satır numaraları (1-tabanlı — kırmızı `-` işareti) */
  remove?: number[];
  /** Eklenen / yeni satır numaraları (1-tabanlı — yeşil `+` işareti) */
  add?: number[];
}

export interface CodeWindowProps {
  /** Gösterilecek kod / SQL / terminal metni */
  code: string;
  /** Söz dizimi renklendirme dili */
  language?: CodeLanguage;
  /** Karanlık pencere üst çubuğundaki dosya veya terminal başlığı */
  title?: string;
  /** Sabit parlatılacak 1-tabanlı satır numaraları (ör. [4, 5, 6]) */
  highlightLines?: number[];
  /** Tek sahne içinde zamanlı çok adımlı satır odağı (ör. 0s -> [2,3], 2.2s -> [5,6,7]) */
  focusSteps?: CodeFocusStep[];
  /** Git diff satır vurgusu (`remove`: kırmızı `-`, `add`: yeşil `+`) */
  diffLines?: CodeDiffLines;
  /** `focusSteps` geçişlerinde yumuşak `tick.wav` çalsın mı? (varsayılan: true) */
  playStepTicks?: boolean;
  /** Pencere altındaki kısa teknik açıklama */
  caption?: string;
  /** `SplitStage` gibi üst bileşenlerin içine gömüldüğünde `<AbsoluteFill>` sarmalayıcısını kaldırır */
  embedded?: boolean;
  /** Giriş animasyonunun başlangıç karesi */
  startFrame?: number;
}

interface Token {
  text: string;
  color: string;
  italic?: boolean;
  bold?: boolean;
}

const SQL_KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE",
  "CREATE", "TABLE", "ALTER", "DROP", "INDEX", "PRIMARY", "KEY", "FOREIGN", "REFERENCES",
  "NOT", "NULL", "UNIQUE", "CHECK", "DEFAULT", "CONSTRAINT", "EXCLUDE", "USING", "GIST",
  "WITH", "AND", "OR", "AS", "ON", "JOIN", "INNER", "LEFT", "RIGHT", "GROUP", "BY",
  "ORDER", "HAVING", "LIMIT", "INT", "INTEGER", "VARCHAR", "TEXT", "DATE", "BOOLEAN",
  "TIMESTAMP", "SERIAL", "DATERANGE", "CASCADE", "ENGINE", "INNODB", "BIGINT", "DECIMAL",
  "EXPLAIN", "ANALYZE", "FOR", "BTREE", "EXISTS", "COUNT",
]);

const BASH_KEYWORDS = new Set([
  "npm", "npx", "node", "python", "python3", "pip", "git", "docker", "curl", "cd",
  "ls", "mkdir", "rm", "cp", "mv", "echo", "export", "sudo", "chmod", "ffmpeg",
  "remotion", "render", "studio", "run", "install", "if", "then", "else", "fi", "for",
  "mvn", "mysql",
]);

const JAVA_KEYWORDS = new Set([
  "public", "private", "protected", "class", "interface", "record", "enum", "extends",
  "implements", "static", "final", "void", "return", "new", "if", "else", "for", "while",
  "try", "catch", "throw", "throws", "import", "package", "boolean", "int", "long",
  "double", "var", "true", "false", "null", "this", "super",
]);

function tokenizeLine(line: string, language: CodeLanguage): Token[] {
  const trimmed = line.trimStart();

  if (
    (language === "sql" && trimmed.startsWith("--")) ||
    (language === "bash" && trimmed.startsWith("#")) ||
    (language === "java" && trimmed.startsWith("//"))
  ) {
    return [{ text: line, color: COLORS.textMuted, italic: true }];
  }

  const commentMarker =
    language === "sql" ? "--" : language === "bash" ? " #" : "//";
  const commentIdx = line.indexOf(commentMarker);
  const codePart = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
  const commentPart = commentIdx >= 0 ? line.slice(commentIdx) : "";

  const tokens: Token[] = [];
  const regex =
    /('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|@[A-Za-z_]\w*|--?[A-Za-z0-9_-]+|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(codePart)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        text: codePart.slice(lastIndex, match.index),
        color: COLORS.textPrimary,
      });
    }

    const word = match[0];

    if (word.startsWith("'") || word.startsWith('"')) {
      tokens.push({ text: word, color: COLORS.codeString });
    } else if (word.startsWith("@") && language === "java") {
      tokens.push({ text: word, color: COLORS.accent, bold: true });
    } else if (word.startsWith("-") && language === "bash") {
      tokens.push({ text: word, color: COLORS.codeString });
    } else if (/^\d/.test(word)) {
      tokens.push({ text: word, color: COLORS.codeNumber, bold: true });
    } else if (
      (language === "sql" && SQL_KEYWORDS.has(word.toUpperCase())) ||
      (language === "bash" && BASH_KEYWORDS.has(word)) ||
      (language === "java" && JAVA_KEYWORDS.has(word))
    ) {
      tokens.push({ text: word, color: COLORS.accent, bold: true });
    } else if (language === "java" && /^[A-Z][A-Za-z0-9_]*$/.test(word)) {
      tokens.push({ text: word, color: COLORS.codeType });
    } else {
      tokens.push({ text: word, color: COLORS.textPrimary });
    }

    lastIndex = match.index + word.length;
  }

  if (lastIndex < codePart.length) {
    tokens.push({
      text: codePart.slice(lastIndex),
      color: COLORS.textPrimary,
    });
  }

  if (commentPart) {
    tokens.push({ text: commentPart, color: COLORS.textMuted, italic: true });
  }

  return tokens.length > 0 ? tokens : [{ text: " ", color: COLORS.textPrimary }];
}

/**
 * CodeWindow v3 (Kişisel İmza — Çok Adımlı Odak `focusSteps` + Git Diff + CAD Çerçeve)
 * - `focusSteps` ile tek sahne içinde satır blokları arası yay fiziğiyle (ve `tick.wav` ile) odak kaydırır.
 * - `diffLines` ile kaldırılan (`-` kırmızı) ve eklenen (`+` yeşil) satırları net gösterir.
 * - `embedded: true` ile `SplitStage` sol/sağ bölmesine doğrudan oturabilir.
 */
export const CodeWindow: React.FC<CodeWindowProps> = ({
  code,
  language = "sql",
  title,
  highlightLines = [],
  focusSteps,
  diffLines,
  playStepTicks = true,
  caption,
  embedded = false,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - startFrame);

  const windowEntrance = spring({
    frame: localFrame,
    fps,
    config: MOTION.editorial,
  });

  // Çok adımlı odak çözümü (`focusSteps` varsa zaman çizelgesinden aktif ve önceki adımı bul)
  const sortedSteps = React.useMemo(() => {
    if (!focusSteps || focusSteps.length === 0) return [];
    return [...focusSteps].sort((a, b) => a.atSec - b.atSec);
  }, [focusSteps]);

  const hasFocusSteps = sortedSteps.length > 0;
  const localSec = localFrame / fps;

  let activeStepIdx = 0;
  if (hasFocusSteps) {
    for (let i = 0; i < sortedSteps.length; i++) {
      if (localSec >= sortedSteps[i].atSec) {
        activeStepIdx = i;
      }
    }
  }

  const activeStep = hasFocusSteps ? sortedSteps[activeStepIdx] : undefined;
  const prevStep =
    hasFocusSteps && activeStepIdx > 0 ? sortedSteps[activeStepIdx - 1] : undefined;

  const stepTriggerFrame = activeStep
    ? Math.max(secToFrames(0.18, fps), secToFrames(activeStep.atSec, fps))
    : secToFrames(0.22, fps);

  const focusProgress = spring({
    frame: Math.max(0, localFrame - stepTriggerFrame),
    fps,
    config: MOTION.snap,
  });

  const activeHighlightSet = new Set(
    hasFocusSteps ? (activeStep?.lines ?? []) : highlightLines
  );
  const prevHighlightSet = new Set(prevStep?.lines ?? []);

  const removeSet = new Set(diffLines?.remove ?? []);
  const addSet = new Set(diffLines?.add ?? []);
  const hasDiff = removeSet.size > 0 || addSet.size > 0;
  const hasAnyFocus = activeHighlightSet.size > 0 || hasDiff;

  const activeCaption = activeStep?.caption ?? caption;
  const captionTriggerFrame = hasFocusSteps
    ? stepTriggerFrame
    : secToFrames(0.30, fps);
  const captionEntrance = spring({
    frame: Math.max(0, localFrame - captionTriggerFrame),
    fps,
    config: MOTION.snap,
  });

  const lines = code.replace(/\r\n/g, "\n").split("\n");
  const defaultTitle =
    language === "sql"
      ? "schema.sql"
      : language === "bash"
        ? "terminal — zsh"
        : "ReservationService.java";

  // Gömülü (60% sütun) veya tam ekran genişliğine göre dengeli yazı boyutu
  const fontSize = embedded
    ? lines.length > 11
      ? 16
      : lines.length > 8
        ? 17.5
        : 19
    : lines.length > 12
      ? 19
      : lines.length > 9
        ? 21
        : 23;

  const windowBox = (
    <div
      className="relative w-full"
      style={{
        maxWidth: embedded ? undefined : 1380,
        background: COLORS.codeBg,
        backdropFilter: GLASS_TOKENS.blur,
        WebkitBackdropFilter: GLASS_TOKENS.blur,
        border: COLORS.border,
        borderRadius: GLASS_TOKENS.borderRadius,
        boxShadow: `0 34px 86px rgba(0, 0, 0, 0.78), inset 0 1px 0 ${COLORS.borderHighlight}`,
        opacity: interpolate(windowEntrance, [0, 0.55], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        transform: `translate3d(0, ${interpolate(windowEntrance, [0, 1], [24, 0])}px, 0) scale(${interpolate(windowEntrance, [0, 1], [0.97, 1])})`,
      }}
    >
      <CadCorners size={embedded ? 12 : 14} accent startFrame={startFrame} />
      <SpecularSweep startFrame={startFrame} />

      {/* Çok adımlı odak geçişlerinde ince mekanik `tick.wav` ses tetikleyicisi */}
      {playStepTicks &&
        sortedSteps.slice(1).map((step, sIdx) => {
          const tickFrame = startFrame + secToFrames(step.atSec, fps);
          return (
            <Sequence key={`code-tick-${sIdx}`} from={tickFrame} durationInFrames={secToFrames(0.3, fps)}>
              <Audio src={staticFile("sfx/tick.wav")} volume={0.15} />
            </Sequence>
          );
        })}

      {/* Üst pencere çubuğu */}
      <div
        className="relative flex items-center justify-between px-5"
        style={{
          height: embedded ? 46 : 52,
          borderBottom: COLORS.border,
          background: "rgba(255, 255, 255, 0.018)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "rgba(255, 95, 86, 0.65)",
            }}
          />
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "rgba(245, 158, 11, 0.72)",
            }}
          />
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "rgba(52, 211, 153, 0.65)",
            }}
          />
        </div>

        <span
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            fontFamily: FONTS.mono,
            fontSize: embedded ? 12.5 : 13.5,
            fontWeight: 500,
            color: COLORS.textSecondary,
            letterSpacing: "0.03em",
            whiteSpace: "nowrap",
          }}
        >
          {title ?? defaultTitle}
        </span>

        {/* Sağ rozet grubu: Diff sayacı + Çok adımlı odak göstergesi + Dil rozeti */}
        <div className="flex items-center gap-2">
          {hasDiff && (
            <div
              className="flex items-center gap-2 px-2 py-0.5"
              style={{
                borderRadius: 5,
                background: "rgba(255, 255, 255, 0.03)",
                border: COLORS.border,
                fontFamily: FONTS.mono,
                fontSize: 11,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {addSet.size > 0 && (
                <span style={{ color: COLORS.success }}>+{addSet.size}</span>
              )}
              {removeSet.size > 0 && (
                <span style={{ color: COLORS.danger }}>-{removeSet.size}</span>
              )}
            </div>
          )}

          {sortedSteps.length > 1 && (
            <span
              className="px-2 py-0.5"
              style={{
                borderRadius: 5,
                fontFamily: FONTS.mono,
                fontSize: 11,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                color: COLORS.textSecondary,
                background: "rgba(255, 255, 255, 0.04)",
                border: COLORS.border,
              }}
            >
              {activeStepIdx + 1}/{sortedSteps.length}
            </span>
          )}

          <span
            className="px-2.5 py-0.5 uppercase"
            style={{
              borderRadius: 5,
              fontFamily: FONTS.mono,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.14em",
              color: COLORS.accent,
              background: COLORS.accentSoft,
              border: `1px solid ${COLORS.accentBorder}`,
            }}
          >
            {language}
          </span>
        </div>
      </div>

      {/* Kod satırları alanı */}
      <div
        className={embedded ? "py-5" : "py-6"}
        style={{
          fontFamily: FONTS.mono,
          fontSize,
          lineHeight: 1.66,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {lines.map((lineText, idx) => {
          const lineNum = idx + 1;
          const isRemoved = removeSet.has(lineNum);
          const isAdded = addSet.has(lineNum);
          const isFocusedNow = activeHighlightSet.has(lineNum);
          const wasFocusedBefore = prevHighlightSet.has(lineNum);

          // Önceki adımdan aktif adıma pürüzsüz opaklık ve vurgu geçişi
          const isActiveLine = isFocusedNow || isRemoved || isAdded;
          const prevOpacity =
            hasFocusSteps && activeStepIdx > 0
              ? wasFocusedBefore || isRemoved || isAdded
                ? 1
                : 0.35
              : 1;
          const targetOpacity = hasAnyFocus ? (isActiveLine ? 1 : 0.35) : 1;

          const lineOpacity = interpolate(
            focusProgress,
            [0, 1],
            [prevOpacity, targetOpacity]
          );

          const prevHighlightWeight =
            hasFocusSteps && activeStepIdx > 0 && wasFocusedBefore ? 1 : 0;
          const targetHighlightWeight = isFocusedNow ? 1 : 0;
          const highlightWeight = interpolate(
            focusProgress,
            [0, 1],
            [prevHighlightWeight, targetHighlightWeight]
          );

          const diffReveal = interpolate(focusProgress, [0, 1], [0, 1]);

          // Satır arka plan ve sol şerit rengi (Diff öncelikli, ardından sıcak kehribar odak)
          let rowBg = "transparent";
          let barColor: string | null = null;
          let barWeight = 0;

          if (isRemoved) {
            rowBg = `rgba(248, 113, 113, ${0.12 * diffReveal})`;
            barColor = COLORS.danger;
            barWeight = diffReveal;
          } else if (isAdded) {
            rowBg = `rgba(52, 211, 153, ${0.11 * diffReveal})`;
            barColor = COLORS.success;
            barWeight = diffReveal;
          } else if (highlightWeight > 0.01) {
            rowBg = `rgba(245, 158, 11, ${0.11 * highlightWeight})`;
            barColor = COLORS.accent;
            barWeight = highlightWeight;
          }

          const tokens = tokenizeLine(lineText, language);

          return (
            <div
              key={`line-${lineNum}`}
              className={`relative flex items-baseline ${embedded ? "px-5" : "px-7"}`}
              style={{
                opacity: lineOpacity,
                background: rowBg,
                paddingTop: 3,
                paddingBottom: 3,
              }}
            >
              {barColor && barWeight > 0.01 && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    background: barColor,
                    boxShadow: `0 0 12px ${barColor}`,
                    opacity: barWeight,
                    transform: `scaleY(${barWeight})`,
                    transformOrigin: "center center",
                  }}
                />
              )}

              {/* Satır numarası */}
              <span
                className={`${hasDiff ? "mr-3" : embedded ? "mr-5" : "mr-7"} inline-block select-none text-right`}
                style={{
                  width: 30,
                  flexShrink: 0,
                  fontSize: fontSize - 3.5,
                  color: isRemoved
                    ? COLORS.danger
                    : isAdded
                      ? COLORS.success
                      : isFocusedNow
                        ? COLORS.accent
                        : COLORS.textMuted,
                  fontWeight: isActiveLine ? 600 : 400,
                }}
              >
                {lineNum}
              </span>

              {/* Git Diff işareti (`-` / `+`) */}
              {hasDiff && (
                <span
                  className="mr-3 inline-block select-none text-center"
                  style={{
                    width: 16,
                    flexShrink: 0,
                    fontWeight: 700,
                    color: isRemoved
                      ? COLORS.danger
                      : isAdded
                        ? COLORS.success
                        : "transparent",
                  }}
                >
                  {isRemoved ? "−" : isAdded ? "+" : " "}
                </span>
              )}

              {/* Söz dizimi renklendirilmiş satır metni */}
              <span
                style={{
                  whiteSpace: "pre",
                  color: COLORS.textPrimary,
                  textDecoration: isRemoved ? "line-through" : "none",
                  textDecorationColor: "rgba(248, 113, 113, 0.55)",
                }}
              >
                {tokens.map((tok, tIdx) => (
                  <span
                    key={tIdx}
                    style={{
                      color: isRemoved ? "#fca5a5" : tok.color,
                      fontStyle: tok.italic ? "italic" : "normal",
                      fontWeight: tok.bold ? 600 : 400,
                    }}
                  >
                    {tok.text}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (embedded) {
    return windowBox;
  }

  return (
    <AbsoluteFill className="flex flex-col items-center justify-center px-24">
      {windowBox}

      {activeCaption && (
        <div
          key={`cap-${activeStepIdx}-${activeCaption}`}
          className="mt-7 flex items-center gap-3 px-6 py-3"
          style={{
            borderRadius: GLASS_TOKENS.borderRadiusSm,
            background: COLORS.cardBg,
            backdropFilter: GLASS_TOKENS.blur,
            WebkitBackdropFilter: GLASS_TOKENS.blur,
            border: COLORS.border,
            opacity: interpolate(captionEntrance, [0, 0.7], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: `translate3d(0, ${interpolate(captionEntrance, [0, 1], [10, 0])}px, 0)`,
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
            {activeCaption}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};

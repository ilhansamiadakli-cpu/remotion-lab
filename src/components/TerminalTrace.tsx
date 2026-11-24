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
import { COLORS, FONTS, GLASS_TOKENS, MOTION, secToFrames } from "../theme";
import { CadCorners, SpecularSweep } from "./CadFrame";

export interface TerminalTraceProps {
  /** Terminal pencere üst başlığı */
  title?: string;
  /** Terminal prompt öneki (varsayılan: "mac@otel-api ~ %") */
  prompt?: string;
  /** Yazılacak terminal / curl komutu */
  command: string;
  /** İsteğe bağlı gönderilen JSON gövdesi */
  requestBody?: string;
  /** HTTP durum kodu (ör. 409, 201, 200, 500) */
  statusCode: number;
  /** HTTP durum açıklaması (ör. "Conflict", "Created", "OK") */
  statusText: string;
  /** Yanıt gecikmesi rozeti (ör. "9 ms") */
  latency?: string;
  /** Dönen JSON veya terminal çıktı gövdesi */
  responseBody: string;
  /** Yanıt bloğunun ekrana düşeceği yerel saniye (varsayılan: 1.35 sn) */
  responseAtSec?: number;
  /** Yanıt içinde öne çıkarılacak 1-tabanlı satır numaraları */
  highlightResponseLines?: number[];
  /** Yanıt düştüğünde yumuşak `tick.wav` çalsın mı? (varsayılan: true) */
  playResponseTick?: boolean;
  /** Pencere altındaki kısa teknik açıklama */
  caption?: string;
  /** `SplitStage` içine gömüldüğünde `<AbsoluteFill>` sarmalayıcısını kaldırır */
  embedded?: boolean;
  startFrame?: number;
}

interface JsonToken {
  text: string;
  color: string;
  bold?: boolean;
}

function tokenizeJsonLine(line: string): JsonToken[] {
  const tokens: JsonToken[] = [];
  const regex =
    /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(\b(?:true|false|null)\b)|(-?\b\d+(?:\.\d+)?\b)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        text: line.slice(lastIndex, match.index),
        color: COLORS.textSecondary,
      });
    }

    if (match[1]) {
      // JSON anahtarı ("error":)
      const colonIdx = match[1].lastIndexOf(":");
      tokens.push({
        text: match[1].slice(0, colonIdx),
        color: COLORS.accent,
        bold: true,
      });
      tokens.push({
        text: match[1].slice(colonIdx),
        color: COLORS.textMuted,
      });
    } else if (match[2]) {
      // JSON string değeri
      tokens.push({
        text: match[2],
        color: COLORS.codeString,
      });
    } else if (match[3]) {
      // boolean / null
      tokens.push({
        text: match[3],
        color: COLORS.accentBright,
        bold: true,
      });
    } else if (match[4]) {
      // sayısal değer
      tokens.push({
        text: match[4],
        color: COLORS.codeNumber,
        bold: true,
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    tokens.push({
      text: line.slice(lastIndex),
      color: COLORS.textSecondary,
    });
  }

  return tokens.length > 0 ? tokens : [{ text: " ", color: COLORS.textPrimary }];
}

function getStatusTheme(statusCode: number) {
  if (statusCode >= 200 && statusCode < 300) {
    return {
      color: COLORS.success,
      bg: COLORS.successSoft,
      border: COLORS.successBorder,
      wash: "rgba(52, 211, 153, 0.11)",
    };
  }
  if (statusCode >= 400) {
    return {
      color: COLORS.danger,
      bg: COLORS.dangerSoft,
      border: COLORS.dangerBorder,
      wash: "rgba(248, 113, 113, 0.11)",
    };
  }
  return {
    color: COLORS.accent,
    bg: COLORS.accentSoft,
    border: COLORS.accentBorder,
    wash: "rgba(245, 158, 11, 0.11)",
  };
}

/**
 * TerminalTrace (Kilitli Bileşen Havuzu #10 — Canlı cURL / HTTP JSON Yanıt İzleyici)
 * Komutu karakter bazlı yazıp ardından `statusCode` renk kodlamalı HTTP başlığını
 * ve söz dizimi renklendirilmiş JSON gövdesini `tick.wav` ile sahneye düşürür.
 */
export const TerminalTrace: React.FC<TerminalTraceProps> = ({
  title = "zsh — localhost:8080",
  prompt = "mac@otel-api ~ %",
  command,
  requestBody,
  statusCode,
  statusText,
  latency = "9 ms",
  responseBody,
  responseAtSec = 1.35,
  highlightResponseLines = [],
  playResponseTick = true,
  caption,
  embedded = false,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - startFrame);

  // Pencere giriş yayı
  const windowEntrance = spring({
    frame: localFrame,
    fps,
    config: MOTION.editorial,
  });

  // Komutun karakter karakter yazılma aralığı (0.16 sn -> responseAtSec - 0.30 sn)
  const typeStartFrame = secToFrames(0.16, fps);
  const responseFrame = Math.max(
    typeStartFrame + secToFrames(0.55, fps),
    secToFrames(responseAtSec, fps)
  );
  const typeEndFrame = Math.max(
    typeStartFrame + 1,
    responseFrame - secToFrames(0.28, fps)
  );

  const typeProgress = interpolate(
    localFrame,
    [typeStartFrame, typeEndFrame],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    }
  );

  const visibleCharCount = Math.round(command.length * typeProgress);
  const typedCommand = command.slice(0, visibleCharCount);
  const isTypingDone = localFrame >= typeEndFrame;
  const isResponseVisible = localFrame >= responseFrame;

  // İstek gövdesi (varsa) komut yazımı biterken açılır
  const reqBodySpring = spring({
    frame: Math.max(0, localFrame - (typeEndFrame - secToFrames(0.12, fps))),
    fps,
    config: MOTION.snap,
  });

  // Yanıt başlığı ve JSON gövdesi giriş yayı
  const responseSpring = spring({
    frame: Math.max(0, localFrame - responseFrame),
    fps,
    config: MOTION.snap,
  });

  const captionSpring = spring({
    frame: Math.max(0, localFrame - (responseFrame + secToFrames(0.18, fps))),
    fps,
    config: MOTION.snap,
  });

  // Yanıp sönen kehribar terminal imleci
  const cursorVisible = !isResponseVisible && Math.floor((localFrame / fps) * 4) % 2 === 0;

  const statusTheme = getStatusTheme(statusCode);
  const responseLines = responseBody.replace(/\r\n/g, "\n").split("\n");
  const highlightSet = new Set(highlightResponseLines);
  const hasHighlights = highlightSet.size > 0;

  const codeFontSize = embedded ? 16.5 : responseLines.length > 9 ? 18.5 : 20.5;

  const terminalBox = (
    <div
      className="relative w-full"
      style={{
        maxWidth: embedded ? undefined : 1380,
        background: COLORS.codeBg,
        backdropFilter: GLASS_TOKENS.blur,
        WebkitBackdropFilter: GLASS_TOKENS.blur,
        border: COLORS.border,
        borderRadius: GLASS_TOKENS.borderRadius,
        boxShadow: `0 34px 86px rgba(0, 0, 0, 0.80), inset 0 1px 0 ${COLORS.borderHighlight}`,
        opacity: interpolate(windowEntrance, [0, 0.55], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        transform: `translate3d(0, ${interpolate(windowEntrance, [0, 1], [24, 0])}px, 0) scale(${interpolate(windowEntrance, [0, 1], [0.97, 1])})`,
      }}
    >
      <CadCorners size={embedded ? 12 : 14} accent startFrame={startFrame} />
      <SpecularSweep startFrame={startFrame} />

      {/* HTTP yanıtı düştüğü anda tek seferlik yumuşak tick sesi */}
      {playResponseTick && (
        <Sequence
          from={startFrame + responseFrame}
          durationInFrames={secToFrames(0.3, fps)}
        >
          <Audio src={staticFile("sfx/tick.wav")} volume={0.16} />
        </Sequence>
      )}

      {/* Terminal Üst Çubuğu */}
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
          }}
        >
          {title}
        </span>

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
          HTTP TRACE
        </span>
      </div>

      {/* Terminal Gövdesi */}
      <div
        className={embedded ? "p-6" : "p-8"}
        style={{
          fontFamily: FONTS.mono,
          fontSize: codeFontSize,
          lineHeight: 1.62,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {/* 1. BÖLÜM: Canlı Yazılan Komut Satırı */}
        <div className="flex items-start gap-3">
          <span
            style={{
              color: COLORS.accent,
              fontWeight: 600,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {prompt}
          </span>
          <span
            className="relative flex-1"
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {/* Komut yazılırken satır atlamasında dikey zıplamayı sıfırlayan görünmez yer tutucu */}
            <span aria-hidden style={{ visibility: "hidden" }}>
              {command}
            </span>
            <span
              style={{
                position: "absolute",
                inset: 0,
                color: COLORS.textBright,
              }}
            >
              {typedCommand}
              {!isResponseVisible && (
                <span
                  style={{
                    display: "inline-block",
                    width: 10,
                    height: codeFontSize,
                    marginLeft: 3,
                    verticalAlign: "text-bottom",
                    background: COLORS.accent,
                    opacity: cursorVisible ? 0.95 : 0.15,
                  }}
                />
              )}
            </span>
          </span>
        </div>

        {/* İsteğe Bağlı Gönderilen JSON Payload (yerleşim zıplamasını önlemek için yüksekliği sabit tutulur) */}
        {requestBody && (
          <div
            className="mt-4 px-4 py-3"
            style={{
              borderRadius: GLASS_TOKENS.borderRadiusSm,
              background: "rgba(255, 255, 255, 0.024)",
              border: COLORS.border,
              fontSize: codeFontSize - 2,
              visibility: isTypingDone ? "visible" : "hidden",
              opacity: isTypingDone
                ? interpolate(reqBodySpring, [0, 0.7], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })
                : 0,
              transform: `translate3d(0, ${
                isTypingDone ? interpolate(reqBodySpring, [0, 1], [8, 0]) : 8
              }px, 0)`,
            }}
          >
            <div
              className="mb-1.5 uppercase tracking-[0.16em]"
              style={{
                fontSize: 10.5,
                color: COLORS.textMuted,
              }}
            >
              REQUEST PAYLOAD
            </div>
            <div style={{ whiteSpace: "pre", color: COLORS.textSecondary }}>
              {requestBody}
            </div>
          </div>
        )}

        {/* 2. BÖLÜM: Sabit Yükseklikli Yanıt Alanı (bekleme satırı <-> HTTP Yanıt yer değiştirir, çerçeve zıplamaz) */}
        <div className="relative mt-6">
          {/* Yanıt Bekleniyor Durum Satırı */}
          {isTypingDone && !isResponseVisible && (
            <div
              className="absolute left-0 top-0 flex items-center gap-2.5"
              style={{
                fontSize: codeFontSize - 2,
                color: COLORS.textMuted,
              }}
            >
              <span style={{ color: COLORS.accent }}>›</span>
              <span>waiting for upstream response...</span>
            </div>
          )}

          {/* HTTP Yanıt Durum Şeridi + JSON Gövde */}
          <div
            style={{
              visibility: isResponseVisible ? "visible" : "hidden",
              opacity: isResponseVisible
                ? interpolate(responseSpring, [0, 0.55], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })
                : 0,
              transform: `translate3d(0, ${
                isResponseVisible ? interpolate(responseSpring, [0, 1], [12, 0]) : 12
              }px, 0)`,
            }}
          >
            {/* HTTP Status Başlık Çubuğu */}
            <div
              className="flex items-center justify-between px-4 py-2.5"
              style={{
                borderTopLeftRadius: GLASS_TOKENS.borderRadiusSm,
                borderTopRightRadius: GLASS_TOKENS.borderRadiusSm,
                background: statusTheme.bg,
                border: `1px solid ${statusTheme.border}`,
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  style={{
                    fontSize: codeFontSize - 3,
                    color: COLORS.textSecondary,
                  }}
                >
                  HTTP/1.1
                </span>
                <span
                  className="px-2.5 py-0.5"
                  style={{
                    borderRadius: 5,
                    background: statusTheme.color,
                    color: COLORS.background,
                    fontSize: codeFontSize - 3,
                    fontWeight: 700,
                    letterSpacing: "0.04em",
                  }}
                >
                  {statusCode} {statusText.toUpperCase()}
                </span>
                <span
                  style={{
                    fontSize: codeFontSize - 4,
                    color: COLORS.textSecondary,
                  }}
                >
                  application/json
                </span>
              </div>

              {latency && (
                <span
                  className="px-2.5 py-0.5"
                  style={{
                    borderRadius: 5,
                    background: "rgba(7, 9, 13, 0.65)",
                    border: COLORS.border,
                    fontSize: codeFontSize - 4,
                    fontWeight: 600,
                    color: COLORS.accentBright,
                  }}
                >
                  {latency}
                </span>
              )}
            </div>

            {/* Söz Dizimi Renklendirilmiş JSON Gövde */}
            <div
              className="py-4"
              style={{
                borderBottomLeftRadius: GLASS_TOKENS.borderRadiusSm,
                borderBottomRightRadius: GLASS_TOKENS.borderRadiusSm,
                background: "rgba(4, 6, 9, 0.72)",
                borderLeft: `1px solid ${statusTheme.border}`,
                borderRight: `1px solid ${statusTheme.border}`,
                borderBottom: `1px solid ${statusTheme.border}`,
              }}
            >
              {responseLines.map((line, idx) => {
                const lineNum = idx + 1;
                const isHighlighted = highlightSet.has(lineNum);
                const lineSpring = spring({
                  frame: Math.max(
                    0,
                    localFrame - (responseFrame + secToFrames(idx * 0.035, fps))
                  ),
                  fps,
                  config: MOTION.snap,
                });

                const targetOpacity = hasHighlights
                  ? isHighlighted
                    ? 1
                    : 0.48
                  : 1;

                const tokens = tokenizeJsonLine(line);

                return (
                  <div
                    key={`res-${lineNum}`}
                    className="relative flex items-baseline px-5"
                    style={{
                      paddingTop: 2,
                      paddingBottom: 2,
                      background: isHighlighted ? statusTheme.wash : "transparent",
                      opacity:
                        interpolate(lineSpring, [0, 0.7], [0, 1], {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                        }) * targetOpacity,
                      transform: `translate3d(0, ${interpolate(lineSpring, [0, 1], [6, 0])}px, 0)`,
                    }}
                  >
                    {isHighlighted && (
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 3,
                          background: statusTheme.color,
                          boxShadow: `0 0 10px ${statusTheme.color}`,
                        }}
                      />
                    )}
                    <span style={{ whiteSpace: "pre" }}>
                      {tokens.map((tok, tIdx) => (
                        <span
                          key={tIdx}
                          style={{
                            color: tok.color,
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
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return terminalBox;
  }

  return (
    <AbsoluteFill className="flex flex-col items-center justify-center px-24">
      {terminalBox}

      {caption && (
        <div
          className="mt-7 flex items-center gap-3 px-6 py-3"
          style={{
            borderRadius: GLASS_TOKENS.borderRadiusSm,
            background: COLORS.cardBg,
            backdropFilter: GLASS_TOKENS.blur,
            WebkitBackdropFilter: GLASS_TOKENS.blur,
            border: COLORS.border,
            visibility: isResponseVisible ? "visible" : "hidden",
            opacity: isResponseVisible
              ? interpolate(captionSpring, [0, 0.7], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 0,
            transform: `translate3d(0, ${
              isResponseVisible ? interpolate(captionSpring, [0, 1], [10, 0]) : 10
            }px, 0)`,
          }}
        >
          <span style={{ width: 6, height: 6, background: statusTheme.color }} />
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

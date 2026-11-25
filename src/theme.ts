import React, { createContext, useContext } from "react";
import { loadFont as loadIBMPlexSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";
import type { SpringConfig } from "remotion";
import {
  THEMES,
  resolveTheme,
  themeToCssVars,
  type ThemeKey,
  type ThemePalette,
  type ThemeProfile,
} from "./themes";

/**
 * Remotion'da fontların deterministik yüklenmesi için `@remotion/google-fonts` kullanılır.
 * `latin-ext` alt kümesi Türkçe karakterlerin (ç, ğ, ı, İ, ö, ş, ü) her karede keskin
 * render edilmesini garanti eder.
 */
const sansFont = loadIBMPlexSans("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin", "latin-ext"],
});

const monoFont = loadJetBrainsMono("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin", "latin-ext"],
});

/**
 * Varsayılan video kompozisyon sabitleri (1080p, 30fps — M1/düşük RAM ve 2x hızlı render).
 * Toplam süre `src/data/timeline.json` veya `src/data/chapters/*.json` dosyalarından otomatik hesaplanır.
 */
export const VIDEO_CONFIG = {
  width: 1920,
  height: 1080,
  fps: 30,
} as const;

/**
 * FPS-bağımsız zaman dönüştürücü:
 * Tüm bileşen içi gecikmeler ham kare sayısı yerine saniye cinsinden tanımlanır,
 * böylece 24 / 30 / 60 fps geçişlerinde animasyon ritmi birebir korunur.
 */
export function secToFrames(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

const DEFAULT_COLORS = THEMES.obsidianAmber.colors;

/**
 * Çoklu Tema Destekli Renk Tokenları (v3.0 — CSS Değişkenleri + Geriye Dönük Obsidian Varsayılanı)
 * `TimelineRenderer` kök konteynere aktif tema değişkenlerini (`--rl-*`) enjekte ettiğinde,
 * mevcut ve yeni tüm bileşenler otomatik olarak `obsidianAmber`, `crtPhosphor`,
 * `blueprintCyan` veya `editorialPaper` profiline geçer.
 */
export const COLORS = {
  background: `var(--rl-background, ${DEFAULT_COLORS.background})`,
  canvasDeep: `var(--rl-canvasDeep, ${DEFAULT_COLORS.canvasDeep})`,

  cardBg: `var(--rl-cardBg, ${DEFAULT_COLORS.cardBg})`,
  glassBg: `var(--rl-glassBg, ${DEFAULT_COLORS.glassBg})`,
  codeBg: `var(--rl-codeBg, ${DEFAULT_COLORS.codeBg})`,
  surfaceSubtle: `var(--rl-surfaceSubtle, ${DEFAULT_COLORS.surfaceSubtle})`,

  borderColor: `var(--rl-borderColor, ${DEFAULT_COLORS.borderColor})`,
  border: `var(--rl-border, ${DEFAULT_COLORS.border})`,
  borderHighlight: `var(--rl-borderHighlight, ${DEFAULT_COLORS.borderHighlight})`,
  cadTick: `var(--rl-cadTick, ${DEFAULT_COLORS.cadTick})`,
  cadTickMuted: `var(--rl-cadTickMuted, ${DEFAULT_COLORS.cadTickMuted})`,

  accent: `var(--rl-accent, ${DEFAULT_COLORS.accent})`,
  accentBright: `var(--rl-accentBright, ${DEFAULT_COLORS.accentBright})`,
  accentRgb: `var(--rl-accentRgb, ${DEFAULT_COLORS.accentRgb})`,
  accentSoft: `var(--rl-accentSoft, ${DEFAULT_COLORS.accentSoft})`,
  accentSubtle: `var(--rl-accentSubtle, ${DEFAULT_COLORS.accentSubtle})`,
  accentBorder: `var(--rl-accentBorder, ${DEFAULT_COLORS.accentBorder})`,
  accentGlow: `var(--rl-accentGlow, ${DEFAULT_COLORS.accentGlow})`,
  accentHighlighter: `var(--rl-accentHighlighter, ${DEFAULT_COLORS.accentHighlighter})`,
  accentHighlighterStart: `var(--rl-accentHighlighterStart, ${DEFAULT_COLORS.accentHighlighterStart})`,
  accentHighlighterEnd: `var(--rl-accentHighlighterEnd, ${DEFAULT_COLORS.accentHighlighterEnd})`,

  ambientPrimary: `var(--rl-ambientPrimary, ${DEFAULT_COLORS.ambientPrimary})`,
  ambientSecondary: `var(--rl-ambientSecondary, ${DEFAULT_COLORS.ambientSecondary})`,
  gridLine: `var(--rl-gridLine, ${DEFAULT_COLORS.gridLine})`,
  dotColor: `var(--rl-dotColor, ${DEFAULT_COLORS.dotColor})`,
  vignetteColor: `var(--rl-vignetteColor, ${DEFAULT_COLORS.vignetteColor})`,

  codeString: `var(--rl-codeString, ${DEFAULT_COLORS.codeString})`,
  codeNumber: `var(--rl-codeNumber, ${DEFAULT_COLORS.codeNumber})`,
  codeType: `var(--rl-codeType, ${DEFAULT_COLORS.codeType})`,

  danger: `var(--rl-danger, ${DEFAULT_COLORS.danger})`,
  dangerSoft: `var(--rl-dangerSoft, ${DEFAULT_COLORS.dangerSoft})`,
  dangerBorder: `var(--rl-dangerBorder, ${DEFAULT_COLORS.dangerBorder})`,
  dangerGlow: `var(--rl-dangerGlow, ${DEFAULT_COLORS.dangerGlow})`,

  success: `var(--rl-success, ${DEFAULT_COLORS.success})`,
  successSoft: `var(--rl-successSoft, ${DEFAULT_COLORS.successSoft})`,
  successBorder: `var(--rl-successBorder, ${DEFAULT_COLORS.successBorder})`,

  textPrimary: `var(--rl-textPrimary, ${DEFAULT_COLORS.textPrimary})`,
  textBright: `var(--rl-textBright, ${DEFAULT_COLORS.textBright})`,
  textSecondary: `var(--rl-textSecondary, ${DEFAULT_COLORS.textSecondary})`,
  textMuted: `var(--rl-textMuted, ${DEFAULT_COLORS.textMuted})`,

  warningBg: `var(--rl-warningBg, ${DEFAULT_COLORS.warningBg})`,
  warningBorder: `var(--rl-warningBorder, ${DEFAULT_COLORS.warningBorder})`,
  warningText: `var(--rl-warningText, ${DEFAULT_COLORS.warningText})`,
} as const;

const ThemeContext = createContext<ThemeProfile>(THEMES.obsidianAmber);

export const ThemeProvider: React.FC<{
  theme: ThemeProfile;
  children: React.ReactNode;
}> = ({ theme, children }) =>
  React.createElement(ThemeContext.Provider, { value: theme }, children);

export function useActiveTheme(): ThemeProfile {
  return useContext(ThemeContext);
}

/**
 * Tipografi Sistemi
 * - `sans`: Başlık ve anlatım metinleri (IBM Plex Sans — mühendislik/donanım karakteri)
 * - `mono`: Etiketler, kod parçaları ve sayısal ölçüler (JetBrains Mono)
 */
export const FONTS = {
  sans: `${sansFont.fontFamily}, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`,
  mono: `${monoFont.fontFamily}, ui-monospace, SFMono-Regular, Menlo, monospace`,
} as const;

/**
 * Geometri & Yüzey Sabitleri (Keskin 10–12px mühendislik köşeleri)
 */
export const GLASS_TOKENS = {
  blur: "blur(12px)",
  borderWidth: 1,
  borderRadius: 12,
  borderRadiusSm: 8,
  cadTickSize: 12,
} as const;

/**
 * Varsayılan monokrom film greni katmanı opaklığı (%2.5 — koyu gradyanlarda H.264 banding'ini önler)
 */
export const FILM_GRAIN_OPACITY = 0.025;

/**
 * Ağırlıklı Mühendislik Hareket Fiziği (Asla doğrusal/robotik hareket kullanılmaz)
 * - `snap`: Mekanik kilitlenme hissi (rozetler, kod odak atlamaları, aktif adım çubuğu)
 * - `editorial`: Sinematik, sıçramasız sönümleme (kartlar, medya pencereleri, kamera geçişleri)
 * - `impact`: Kontrollü mikro vurgu (MetricBanner sayıları ve bölüm açılışları)
 */
export const MOTION = {
  snap: {
    damping: 26,
    stiffness: 300,
    mass: 0.72,
  },
  editorial: {
    damping: 28,
    stiffness: 118,
    mass: 1.05,
  },
  impact: {
    damping: 20,
    stiffness: 195,
    mass: 0.9,
  },
} as const satisfies Record<string, Partial<SpringConfig>>;

// Geriye dönük tam uyumluluk sabitleri
export const SPRING_FAST: Partial<SpringConfig> = MOTION.snap;
export const SPRING_SMOOTH: Partial<SpringConfig> = MOTION.editorial;

export { THEMES, resolveTheme, themeToCssVars };
export type { ThemeKey, ThemePalette, ThemeProfile };

import blueprintCyan from "./blueprintCyan.json";
import crtPhosphor from "./crtPhosphor.json";
import editorialPaper from "./editorialPaper.json";
import obsidianAmber from "./obsidianAmber.json";

export interface ThemePalette {
  background: string;
  canvasDeep: string;
  cardBg: string;
  glassBg: string;
  codeBg: string;
  surfaceSubtle: string;
  borderColor: string;
  border: string;
  borderHighlight: string;
  cadTick: string;
  cadTickMuted: string;
  accent: string;
  accentBright: string;
  accentRgb: string;
  accentSoft: string;
  accentSubtle: string;
  accentBorder: string;
  accentGlow: string;
  accentHighlighter: string;
  accentHighlighterStart: string;
  accentHighlighterEnd: string;
  ambientPrimary: string;
  ambientSecondary: string;
  gridLine: string;
  dotColor: string;
  vignetteColor: string;
  codeString: string;
  codeNumber: string;
  codeType: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  dangerGlow: string;
  success: string;
  successSoft: string;
  successBorder: string;
  textPrimary: string;
  textBright: string;
  textSecondary: string;
  textMuted: string;
  warningBg: string;
  warningBorder: string;
  warningText: string;
}

export interface ThemeProfile {
  id: ThemeKey;
  name: string;
  description: string;
  isLight: boolean;
  filmGrainOpacity: number;
  scanlineOpacity: number;
  colors: ThemePalette;
}

export const THEMES = {
  obsidianAmber: obsidianAmber as ThemeProfile,
  crtPhosphor: crtPhosphor as ThemeProfile,
  blueprintCyan: blueprintCyan as ThemeProfile,
  editorialPaper: editorialPaper as ThemeProfile,
} as const;

export type ThemeKey = keyof typeof THEMES;

export function resolveTheme(key?: string | null): ThemeProfile {
  if (key && key in THEMES) {
    return THEMES[key as ThemeKey];
  }
  return THEMES.obsidianAmber;
}

/**
 * Aktif tema paletini kök `<AbsoluteFill>` üzerinde CSS değişkenlerine (`--rl-*`) dönüştürür.
 * Böylece tüm mevcut bileşenler (`COLORS.*`) hiç kırılmadan aktif temaya anında uyum sağlar.
 */
export function themeToCssVars(theme: ThemeProfile): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [token, value] of Object.entries(theme.colors)) {
    vars[`--rl-${token}`] = value;
  }
  return vars;
}

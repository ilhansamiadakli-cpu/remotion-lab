import { DotMatrixBg } from "./DotMatrixBg";
import { ObsidianGridBg } from "./ObsidianGridBg";
import { RadialGlowBg } from "./RadialGlowBg";

/**
 * Modüler Arka Plan Kayıt Defteri (Registry)
 * `src/data/timeline.json` içinde `"background": "obsidianGrid" | "dotMatrix" | "radialGlow"`
 * anahtarıyla tek satırda seçilir.
 */
export const BACKGROUNDS = {
  obsidianGrid: ObsidianGridBg,
  dotMatrix: DotMatrixBg,
  radialGlow: RadialGlowBg,
} as const;

export type BackgroundKey = keyof typeof BACKGROUNDS;

export { DotMatrixBg, ObsidianGridBg, RadialGlowBg };
export type { BackgroundProps } from "./ObsidianGridBg";

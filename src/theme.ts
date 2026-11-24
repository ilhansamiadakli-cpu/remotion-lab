import { loadFont as loadIBMPlexSans } from "@remotion/google-fonts/IBMPlexSans";
import { loadFont as loadJetBrainsMono } from "@remotion/google-fonts/JetBrainsMono";
import type { SpringConfig } from "remotion";

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

/**
 * Kişisel Görsel İmza — Renk Paleti
 * %92 Monokrom Vantablack/Obsidian + Gümüş-Beyaz + Tek İmza Vurgu: Sıcak Mühendislik Kehribarı (#f59e0b).
 */
export const COLORS = {
  // Ana Vantablack / Obsidian zemin
  background: "#07090d",
  canvasDeep: "#040609",

  // Cam / mat koyu kart yüzeyleri
  cardBg: "rgba(12, 15, 20, 0.84)",
  glassBg: "rgba(12, 15, 21, 0.72)",
  codeBg: "rgba(9, 12, 17, 0.90)",
  surfaceSubtle: "rgba(255, 255, 255, 0.028)",

  // Sıkı mühendislik kenarlıkları: 1px solid rgba(255,255,255,0.08)
  borderColor: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderHighlight: "rgba(255, 255, 255, 0.14)",
  cadTick: "rgba(245, 158, 11, 0.58)",
  cadTickMuted: "rgba(230, 237, 243, 0.28)",

  // Tek imza vurgu rengi: Sıcak Mühendislik Kehribarı (#f59e0b) ve şeffaflık türevleri
  accent: "#f59e0b",
  accentBright: "#fbbf24",
  accentSoft: "rgba(245, 158, 11, 0.12)",
  accentSubtle: "rgba(245, 158, 11, 0.07)",
  accentBorder: "rgba(245, 158, 11, 0.38)",
  accentGlow: "rgba(245, 158, 11, 0.20)",
  accentHighlighter: "rgba(245, 158, 11, 0.24)",
  accentHighlighterStart: "rgba(245, 158, 11, 0.13)",
  accentHighlighterEnd: "rgba(245, 158, 11, 0.32)",

  // Arka plan atmosferik ışık tonları
  ambientPrimary: "rgba(245, 158, 11, 0.075)",
  ambientSecondary: "rgba(148, 163, 184, 0.055)",

  // Kod söz dizimi renkleri (Monokrom + Sıcak Kehribar uyumu)
  codeString: "#fcd34d",
  codeNumber: "#f1f5f9",
  codeType: "#cbd5e1",

  // Semantik durum renkleri (ComparisonCard, diff, uyarılar için tek kaynak)
  danger: "#f87171",
  dangerSoft: "rgba(248, 113, 113, 0.11)",
  dangerBorder: "rgba(248, 113, 113, 0.32)",
  dangerGlow: "rgba(248, 113, 113, 0.12)",

  success: "#34d399",
  successSoft: "rgba(52, 211, 153, 0.12)",
  successBorder: "rgba(52, 211, 153, 0.34)",

  // Tipografi hiyerarşisi
  textPrimary: "#e6edf3",
  textBright: "#f8fafc",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",

  // Geliştirici uyarı rozeti (yalnızca Studio önizleme denetleyicisi)
  warningBg: "rgba(245, 158, 11, 0.14)",
  warningBorder: "rgba(245, 158, 11, 0.45)",
  warningText: "#fbbf24",
} as const;

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
 * Monokrom film greni katmanı opaklığı (%2.5 — koyu gradyanlarda H.264 banding'ini önler)
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

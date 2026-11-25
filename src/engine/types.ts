import type { BackgroundKey } from "../backgrounds";
import type {
  CodeWindowProps,
  ComparisonCardProps,
  ComponentType,
  GlassCardProps,
  HighlighterTextProps,
  MediaWindowProps,
  MemoryBarSimProps,
  MetricBannerProps,
  NodeFlowProps,
  RayCastConeSimProps,
  ReferenceListProps,
  SplitStageProps,
  StepCardProps,
  TerminalTraceProps,
} from "../components";
import type { ThemeKey } from "../theme";

export type SfxKey = "whoosh" | "pop" | "tick" | "thud" | "none";

export type SceneTransition =
  | "fade-slide"
  | "editorial"
  | "slideLeft"
  | "depthZoom"
  | "focusBlur";

export interface ComponentPropsMap {
  HighlighterText: HighlighterTextProps;
  GlassCard: GlassCardProps;
  NodeFlow: NodeFlowProps;
  StepCard: StepCardProps;
  CodeWindow: CodeWindowProps;
  ComparisonCard: ComparisonCardProps;
  MediaWindow: MediaWindowProps;
  MetricBanner: MetricBannerProps;
  SplitStage: SplitStageProps;
  TerminalTrace: TerminalTraceProps;
  MemoryBarSim: MemoryBarSimProps;
  RayCastConeSim: RayCastConeSimProps;
  ReferenceList: ReferenceListProps;
}

/**
 * Her sahne (beat) için discriminated union tipi.
 * `timeline.json` veya `chapters/*.json` içindeki `component` değerine göre doğru props tipini doğrular.
 */
export type TimelineBeat = {
  [K in ComponentType]: {
    id: string;
    startSec: number;
    endSec: number;
    component: K;
    background?: BackgroundKey;
    blurBackground?: boolean;
    /** Sahne geçiş karakteri (varsayılan: `src/config/director.json` -> `transitions.defaultType`) */
    transition?: SceneTransition;
    /** Sol üst minimalist HUD için opsiyonel bölüm etiketi */
    chapterLabel?: string;
    sfx?: SfxKey;
    sfxVolume?: number;
    props: Omit<ComponentPropsMap[K], "children" | "beatDurationInFrames">;
  };
}[ComponentType];

/**
 * Birden fazla bölüm (`chapters/*.json`) birleştirilirken her bölümün kendi ses kaydını
 * doğru ofsetle çalabilmek için kullanılan dahili ses parçası tipi.
 */
export interface AudioTrackSegment {
  src: string;
  startSec: number;
  durationSec?: number;
  volume?: number;
}

/**
 * `src/data/timeline.json` ve `src/data/chapters/*.json` kök veri sözleşmesi.
 * Yeni video üretmek için yalnızca bu şemaya uyan JSON verisini değiştirmek yeterlidir.
 */
export interface TimelineSpec {
  meta: {
    title: string;
    fps?: number;
    width?: number;
    height?: number;
    durationSec?: number;
  };
  /** `public/audio/` altındaki ana konuşma ses dosyası (ör. "kayit_temiz.wav" veya null) */
  audio?: string | null;
  /** Ana ses dosyasının kaçıncı saniyeden başlayacağı (bölünmüş tekil chapter render'ları için) */
  audioOffsetSec?: number;
  audioVolume?: number;
  /** `public/audio/` altındaki döngülü (loop) hafif arka plan müziği (ör. "audio/ambient.mp3") */
  bgMusic?: string | null;
  /** Arka plan müziği ses seviyesi (varsayılan: 0.06 — ana konuşmayı bastırmaz) */
  bgMusicVolume?: number;
  /** Minimalist üst bölüm izi ve 2px alt ilerleme çizgisi gösterilsin mi? (varsayılan: true) */
  showHud?: boolean;
  /** Seriye özel görsel tema profili (belirtilmezse `src/config/director.json` -> `activeTheme` kullanılır) */
  theme?: ThemeKey;
  /** Sahne düzeyinde belirtilmezse kullanılacak varsayılan arka plan */
  background: BackgroundKey;
  /** Bölüm birleştirici tarafından opsiyonel olarak üretilen zamanlı ses parçaları */
  audioSegments?: AudioTrackSegment[];
  beats: TimelineBeat[];
}

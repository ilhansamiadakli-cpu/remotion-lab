import { CodeWindow } from "./CodeWindow";
import { ComparisonCard } from "./ComparisonCard";
import { GlassCard } from "./GlassCard";
import { HighlighterText } from "./HighlighterText";
import { MediaWindow } from "./MediaWindow";
import { MetricBanner } from "./MetricBanner";
import { NodeFlow } from "./NodeFlow";
import { SplitStage } from "./SplitStage";
import { StepCard } from "./StepCard";
import { TerminalTrace } from "./TerminalTrace";

/**
 * Kilitli Bileşen Havuzu Kayıt Defteri (v2.3 — 10 Modüler Bileşen)
 * `src/data/timeline.json` veya `src/data/chapters/*.json` içindeki her beat'in
 * `component` alanı bu havuzdan otomatik çözülür.
 */
export const COMPONENTS = {
  HighlighterText,
  GlassCard,
  NodeFlow,
  StepCard,
  CodeWindow,
  ComparisonCard,
  MediaWindow,
  MetricBanner,
  SplitStage,
  TerminalTrace,
} as const;

export type ComponentType = keyof typeof COMPONENTS;

export { CadCorners, SpecularSweep } from "./CadFrame";
export type { CadCornersProps, SpecularSweepProps } from "./CadFrame";
export { CodeWindow } from "./CodeWindow";
export type {
  CodeDiffLines,
  CodeFocusStep,
  CodeLanguage,
  CodeWindowProps,
} from "./CodeWindow";
export { ComparisonCard } from "./ComparisonCard";
export type { ComparisonCardProps } from "./ComparisonCard";
export { DashedConnector } from "./DashedConnector";
export type { DashedConnectorProps, Point } from "./DashedConnector";
export { GlassCard } from "./GlassCard";
export type { GlassCardItem, GlassCardProps } from "./GlassCard";
export { HighlighterText } from "./HighlighterText";
export type { HighlighterTextProps } from "./HighlighterText";
export { MediaWindow } from "./MediaWindow";
export type { MediaWindowProps } from "./MediaWindow";
export { MetricBanner } from "./MetricBanner";
export type { MetricBannerProps } from "./MetricBanner";
export { NodeFlow } from "./NodeFlow";
export type { FlowNode, NodeFlowProps } from "./NodeFlow";
export { SplitStage } from "./SplitStage";
export type {
  SplitMetric,
  SplitPoint,
  SplitStageProps,
  SplitVisual,
} from "./SplitStage";
export { StepCard } from "./StepCard";
export type { StepCardProps, StepItem } from "./StepCard";
export { TerminalTrace } from "./TerminalTrace";
export type { TerminalTraceProps } from "./TerminalTrace";

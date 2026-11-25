import { CodeWindow } from "./CodeWindow";
import { ComparisonCard } from "./ComparisonCard";
import { GlassCard } from "./GlassCard";
import { HighlighterText } from "./HighlighterText";
import { MediaWindow } from "./MediaWindow";
import { MemoryBarSim } from "./MemoryBarSim";
import { MetricBanner } from "./MetricBanner";
import { NodeFlow } from "./NodeFlow";
import { RayCastConeSim } from "./RayCastConeSim";
import { ReferenceList } from "./ReferenceList";
import { SplitStage } from "./SplitStage";
import { StepCard } from "./StepCard";
import { TerminalTrace } from "./TerminalTrace";

/**
 * Kilitli Bileşen Havuzu Kayıt Defteri (v3.0 — 13 Modüler Bileşen)
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
  MemoryBarSim,
  RayCastConeSim,
  ReferenceList,
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
export { MemoryBarSim } from "./MemoryBarSim";
export type { MemoryBarSimProps, MemoryBlockSpec } from "./MemoryBarSim";
export { MetricBanner } from "./MetricBanner";
export type { MetricBannerProps } from "./MetricBanner";
export { NodeFlow } from "./NodeFlow";
export type { FlowNode, NodeFlowProps } from "./NodeFlow";
export { RayCastConeSim } from "./RayCastConeSim";
export type { RayCastConeSimProps } from "./RayCastConeSim";
export { ReferenceList } from "./ReferenceList";
export type { ReferenceItem, ReferenceListProps } from "./ReferenceList";
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

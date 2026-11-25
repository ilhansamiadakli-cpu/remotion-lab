import rawDirector from "./director.json";
import type { ThemeKey } from "../themes";
import type { SceneTransition } from "../engine/types";

export interface DirectorConfig {
  activeTheme: ThemeKey;
  timing: {
    speechLeadPaddingSec: number;
    speechTailPaddingSec: number;
    minSceneDurationSec: number;
    maxSceneDurationSec: number;
    animationStartOffsetSec: number;
  };
  transitions: {
    defaultType: SceneTransition;
    durationFrames: number;
    springDamping: number;
    springStiffness: number;
  };
  previewRender: {
    scale: number;
    crf: number;
  };
}

export const DIRECTOR_CONFIG: DirectorConfig = rawDirector as DirectorConfig;

import { NitroModules } from 'react-native-nitro-modules'
import type { VisionDetector } from './specs/VisionDetector.nitro'

export type {
  PhotoMetricsResult,
  VisionDetection,
  VisionDetector,
  VisionDetectorStats,
  VisionSubjectKind,
} from './specs/VisionDetector.nitro'

/** 네이티브 ML Kit 감지기 인스턴스를 만든다. */
export function createVisionDetector(): VisionDetector {
  return NitroModules.createHybridObject<VisionDetector>('VisionDetector')
}

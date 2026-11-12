import type { HybridObject } from 'react-native-nitro-modules'
import type { Frame } from 'react-native-vision-camera'

/**
 * 감지 대상 종류.
 * - `face`: ML Kit Face Detection (얼굴 위치/크기만, 신원 식별·임베딩 없음)
 * - `object`: ML Kit Object Detection (스트리밍, 단일 주요 객체, 분류 비활성)
 */
export type VisionSubjectKind = 'face' | 'object'

/**
 * 한 프레임에 대한 감지 결과. 좌표·크기 같은 최소 메타데이터만 담는다.
 * 이미지 바이트는 절대 JS로 넘기지 않는다.
 */
export interface VisionDetection {
  kind: VisionSubjectKind
  /**
   * 정규화(0..1) 바운딩 박스. 프레임을 `orientation`만큼 회전해 "똑바로 세운"
   * 좌표계 기준이며, 미러링은 적용하지 않은 값이다(`isMirrored` 참고).
   */
  x: number
  y: number
  width: number
  height: number
  /** detector가 신뢰도를 제공하는 경우에만 채워진다. */
  confidence?: number
  /** detector가 추적 ID를 제공하는 경우에만 채워진다. */
  trackingId?: number
  /** 똑바로 세운 프레임의 픽셀 너비/높이 */
  frameWidth: number
  frameHeight: number
  /** 프레임 픽셀을 좌우 반전된 것으로 해석해야 하는지 (전면 카메라 등) */
  isMirrored: boolean
  /** 네이티브 단조 시계 기준 분석 완료 시각(ms) */
  timestampMs: number
  /** 이 프레임의 네이티브 분석 소요 시간(ms) */
  analysisDurationMs: number
}

/** 누적 분석 통계. 벤치마크/진단용이며 이미지 정보는 포함하지 않는다. */
export interface VisionDetectorStats {
  analyzedFrames: number
  failedFrames: number
  lastAnalysisDurationMs: number
  averageAnalysisDurationMs: number
}

/**
 * 촬영된 사진 파일에서 계산한 밝기·선명도 지표.
 * 축소 디코딩(긴 변 약 480px)한 그레이스케일 기준이다.
 */
export interface PhotoMetricsResult {
  /** 평균 밝기 0..1 */
  meanLuminance: number
  /** 매우 어두운 픽셀(밝기 < 0.08) 비율 0..1 */
  darkRatio: number
  /** 매우 밝은 픽셀(밝기 > 0.96) 비율 0..1 */
  brightRatio: number
  /** 라플라시안 분산 (0..255 그레이 기준) */
  sharpness: number
}

export interface VisionDetector
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * 촬영된 사진 파일(절대 경로)의 밝기·선명도를 백그라운드 스레드에서 계산한다.
   * 파일을 읽을 수 없으면 `undefined`.
   */
  analyzePhoto(path: string): Promise<PhotoMetricsResult | undefined>

  /**
   * 카메라 스레드에서 호출하는 분석 빈도 제한기.
   * 마지막 분석 시작 이후 `minIntervalMs`가 지나지 않았으면 `false`를 반환한다.
   * `false`면 호출자는 프레임을 즉시 dispose하고 버려야 한다.
   */
  shouldAnalyze(minIntervalMs: number): boolean

  /**
   * 프레임 한 장을 동기적으로 분석한다. 카메라 스레드가 아닌
   * VisionCamera AsyncRunner 스레드에서 호출해야 한다.
   * 반환 시점에는 프레임 버퍼를 더 이상 참조하지 않으므로, 호출자가 바로 dispose할 수 있다.
   * 대상이 없으면 `undefined`를 반환한다.
   */
  detect(frame: Frame, kind: VisionSubjectKind): VisionDetection | undefined

  /** 누적 통계 조회 */
  getStats(): VisionDetectorStats

  /** detector 리소스를 닫는다. 이후 `detect`를 다시 호출하면 지연 재생성된다. */
  close(): void
}

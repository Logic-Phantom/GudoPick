/**
 * 구도픽 공통 계약(도메인 타입).
 * UI·카메라 SDK·플랫폼에 의존하지 않는다.
 */

export type ShootingMode = 'portrait' | 'food' | 'landscape' | 'ootd';
export type AspectRatioPreset = '1:1' | '4:5' | '3:4' | '9:16';
export type GuidanceIntensity = 'subtle' | 'normal' | 'strong';
export type NegativeSpace = 'left' | 'right' | 'top' | 'bottom' | 'none';
export type GridKind = 'thirds' | 'center' | 'none';
export type CameraPosition = 'front' | 'back';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** 0..1 정규 좌표 사각형 (기준 영역은 문맥에 따라 프레임 또는 크롭 프레임) */
export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 화면(뷰) 픽셀 좌표 사각형 */
export interface ViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 네이티브 detector가 돌려준 결과를 플랫폼 차이 없이 표현한 값.
 * `bounds`는 "똑바로 세운" 프레임 기준 0..1 좌표이며 미러링은 아직 적용하지 않았다.
 */
export interface DetectionResult {
  kind: 'face' | 'object';
  bounds: NormalizedRect;
  /** detector가 제공하는 경우에만 존재 (ML Kit 얼굴/기본 객체 감지는 제공하지 않음) */
  confidence?: number;
  trackingId?: number | string;
  /** 분석이 끝난 시각(ms). JS 수신 시각 기준 단조 시계 */
  timestamp: number;
  frameWidth: number;
  frameHeight: number;
  orientation: 'portrait' | 'landscape';
  /** 프리뷰가 좌우 반전되어 표시되는지 (전면 카메라) */
  mirrored: boolean;
}

export interface SubjectScaleRange {
  min: number;
  ideal: number;
  max: number;
}

export interface CompositionProfile {
  id: string;
  name: string;
  mode: ShootingMode;
  aspectRatio: AspectRatioPreset;
  /** 크롭 프레임 기준 목표 중심점 (0..1) */
  targetAnchor: Point;
  /**
   * 크롭 프레임 대비 피사체 크기 비율. sqrt(가로비율 × 세로비율)로 계산한 값의 허용 범위.
   */
  targetSubjectScale: SubjectScaleRange;
  negativeSpace: NegativeSpace;
  grid: GridKind;
  levelGuide: boolean;
  guidanceIntensity: GuidanceIntensity;
  holdDurationMs: number;
}

export type GuidanceStatus = 'searching' | 'adjusting' | 'almost' | 'ready' | 'unavailable';
export type GuidanceDirection = 'left' | 'right' | 'up' | 'down' | 'closer' | 'farther' | 'level';

export interface LevelState {
  /** 기울기(도). 양수 = 시계 방향 */
  rollDeg: number;
  isLevel: boolean;
}

export interface GuidanceResult {
  status: GuidanceStatus;
  direction?: GuidanceDirection;
  message: string;
  reasonCode: string;
  /** 내부 구도 정렬 지표(0..1). 사진의 미적 품질 점수가 아니다. */
  alignment: number;
  stableDurationMs: number;
  /** 크롭 프레임 기준 목표 영역 */
  targetBounds?: NormalizedRect;
  /** 크롭 프레임 기준 현재(평활화된) 피사체 영역 */
  currentBounds?: NormalizedRect;
  /** 수평 센서를 쓸 수 있을 때만 존재 */
  level?: LevelState;
}

/**
 * 카메라 구현과 무관한 TypeScript 계약.
 * 현재 구현은 VisionCamera 5 훅 기반(`useGuidedCamera`)이며, 이 계약을 만족한다.
 */
export interface CameraAdapter {
  start(mode: ShootingMode): Promise<void>;
  stop(): Promise<void>;
  setCamera(position: CameraPosition): Promise<void>;
  capture(): Promise<{ uri: string; width: number; height: number }>;
  setFlash(enabled: boolean): Promise<void>;
  subscribeDetections(callback: (result: DetectionResult | null) => void): () => void;
}

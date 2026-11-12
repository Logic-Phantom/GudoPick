import type { DetectionResult } from '@/domain/composition/types';

/** 네이티브 모듈이 돌려주는 값의 구조 (gudopick-vision의 VisionDetection과 동일) */
export interface NativeDetection {
  kind: 'face' | 'object';
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
  trackingId?: number;
  frameWidth: number;
  frameHeight: number;
  isMirrored: boolean;
  timestampMs: number;
  analysisDurationMs: number;
}

/**
 * 네이티브 감지 결과 → 플랫폼 공통 DetectionResult.
 *
 * - `timestamp`는 JS가 결과를 받은 시각으로 기록한다(네이티브 시계와 JS 시계가 다르기 때문).
 *   오래된 결과 판정은 이 값 기준이다.
 * - `mirrored`는 "프리뷰가 좌우 반전되어 보이는지"이며 카메라 위치(전면)로 결정한다.
 *   프레임 버퍼 자체는 반전되어 있지 않다(enablePhysicalBufferRotation 미사용).
 */
export function toDetectionResult(
  native: NativeDetection,
  context: { receivedAt: number; previewMirrored: boolean },
): DetectionResult | null {
  const values = [native.x, native.y, native.width, native.height, native.frameWidth, native.frameHeight];
  if (!values.every(Number.isFinite)) return null;
  if (!(native.width > 0 && native.height > 0 && native.frameWidth > 0 && native.frameHeight > 0)) return null;

  return {
    kind: native.kind,
    bounds: { x: native.x, y: native.y, width: native.width, height: native.height },
    confidence: native.confidence,
    trackingId: native.trackingId,
    timestamp: context.receivedAt,
    frameWidth: native.frameWidth,
    frameHeight: native.frameHeight,
    orientation: native.frameHeight >= native.frameWidth ? 'portrait' : 'landscape',
    mirrored: context.previewMirrored,
  };
}

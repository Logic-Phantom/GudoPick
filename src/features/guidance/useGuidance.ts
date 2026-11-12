import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import {
  computeCropRect,
  cropNormalizedToViewRect,
  mapDetectionToCrop,
} from '@/domain/composition/coordinate-mapper';
import { GuidanceEngine } from '@/domain/composition/guidance-engine';
import { GuidanceMessages } from '@/domain/composition/messages';
import type {
  CompositionProfile,
  DetectionResult,
  GuidanceResult,
  Size,
  ViewRect,
} from '@/domain/composition/types';

const TICK_MS = 150;
/** 크롭 프레임과 프리뷰 가장자리 사이 여백(px) */
export const CROP_INSET = 0;

export interface GuidanceView {
  result: GuidanceResult;
  /** 프리뷰 뷰 좌표 기준 크롭 프레임 */
  cropRect: ViewRect | null;
  /** 프리뷰 뷰 좌표 기준 목표(고스트) 영역 */
  targetRect: ViewRect | null;
  /** 프리뷰 뷰 좌표 기준 현재 피사체 영역. 감지된 경우에만 존재 */
  subjectRect: ViewRect | null;
}

const IDLE_RESULT: GuidanceResult = {
  status: 'unavailable',
  message: GuidanceMessages.manual,
  reasonCode: 'idle',
  alignment: 0,
  stableDurationMs: 0,
};

interface Options {
  profile: CompositionProfile | null;
  /** 프리뷰 뷰 크기. 레이아웃 전에는 null */
  viewSize: Size | null;
  enabled: boolean;
  detectorAvailable: boolean;
  rollRef: RefObject<number | null>;
}

/**
 * 감지 결과 + 수평 센서 + 프로필 → 화면에 그릴 안내 상태.
 * 좌표 변환(프레임 → 프리뷰 → 크롭 프레임)을 여기서 수행하고, 판단은 GuidanceEngine에 맡긴다.
 */
export function useGuidance({ profile, viewSize, enabled, detectorAvailable, rollRef }: Options) {
  const engineRef = useRef<GuidanceEngine | null>(null);
  const detectionRef = useRef<DetectionResult | null>(null);
  const [view, setView] = useState<GuidanceView>({
    result: IDLE_RESULT,
    cropRect: null,
    targetRect: null,
    subjectRect: null,
  });

  const cropRect = useMemo(
    () => (profile && viewSize ? computeCropRect(viewSize, profile.aspectRatio, CROP_INSET) : null),
    [profile, viewSize],
  );

  const evaluate = useCallback(() => {
    if (!profile || !viewSize || !cropRect || !enabled) return;
    if (!engineRef.current) engineRef.current = new GuidanceEngine(profile);
    engineRef.current.setProfile(profile);

    const now = Date.now();
    const detection = detectionRef.current;
    const bounds = detection
      ? mapDetectionToCrop(detection.bounds, {
          frame: { width: detection.frameWidth, height: detection.frameHeight },
          view: viewSize,
          resizeMode: 'cover',
          mirrored: detection.mirrored,
          crop: cropRect,
        })
      : null;

    const result = engineRef.current.update({
      now,
      subject:
        detection && bounds
          ? {
              bounds,
              confidence: detection.confidence,
              trackingId: detection.trackingId,
              timestamp: detection.timestamp,
            }
          : null,
      rollDeg: rollRef.current,
      detectorAvailable,
      cropAspect: cropRect.width / cropRect.height,
    });

    const next: GuidanceView = {
      result,
      cropRect,
      targetRect: result.targetBounds ? cropNormalizedToViewRect(result.targetBounds, cropRect) : null,
      subjectRect: result.currentBounds ? cropNormalizedToViewRect(result.currentBounds, cropRect) : null,
    };
    setView((previous) => (isSameView(previous, next) ? previous : next));
  }, [profile, viewSize, cropRect, enabled, detectorAvailable, rollRef]);

  /** 네이티브 분석 결과가 도착할 때 호출한다. */
  const pushDetection = useCallback(
    (detection: DetectionResult | null) => {
      detectionRef.current = detection;
      evaluate();
    },
    [evaluate],
  );

  // 탐지가 멈춰도(유실/유예/유지 시간) 상태가 흐르도록 주기적으로 평가한다.
  useEffect(() => {
    if (!enabled) {
      detectionRef.current = null;
      engineRef.current?.reset();
      return;
    }
    evaluate();
    const timer = setInterval(evaluate, TICK_MS);
    return () => clearInterval(timer);
  }, [enabled, evaluate]);

  return { ...view, cropRect: cropRect ?? view.cropRect, pushDetection };
}

function isSameView(a: GuidanceView, b: GuidanceView): boolean {
  return (
    a.result.status === b.result.status &&
    a.result.message === b.result.message &&
    a.result.direction === b.result.direction &&
    a.result.level?.isLevel === b.result.level?.isLevel &&
    close(a.result.level?.rollDeg, b.result.level?.rollDeg, 0.4) &&
    sameRect(a.cropRect, b.cropRect) &&
    sameRect(a.targetRect, b.targetRect) &&
    sameRect(a.subjectRect, b.subjectRect)
  );
}

function sameRect(a: ViewRect | null, b: ViewRect | null): boolean {
  if (a === null || b === null) return a === b;
  return close(a.x, b.x, 1) && close(a.y, b.y, 1) && close(a.width, b.width, 1) && close(a.height, b.height, 1);
}

function close(a: number | undefined, b: number | undefined, epsilon: number): boolean {
  if (a === undefined || b === undefined) return a === b;
  return Math.abs(a - b) < epsilon;
}

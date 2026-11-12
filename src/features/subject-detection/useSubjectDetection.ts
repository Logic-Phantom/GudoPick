import { useCallback, useEffect, useMemo, useRef } from 'react';
import { CommonResolutions, useAsyncRunner, useFrameOutput, type Frame } from 'react-native-vision-camera';
import { scheduleOnRN } from 'react-native-worklets';

import { CompositionPolicy } from '@/domain/composition/composition-policy';
import type { DetectionResult } from '@/domain/composition/types';
import { toDetectionResult, type NativeDetection } from '@/infrastructure/native-vision/detection-mapping';
import { closeVisionDetector, getVisionDetector } from '@/infrastructure/native-vision/vision-detector';

interface Options {
  /** 사용할 detector. null이면 분석하지 않는다(풍경 모드 등). */
  kind: 'face' | 'object' | null;
  /** 화면이 활성 상태일 때만 분석한다. */
  enabled: boolean;
  /** 프리뷰가 좌우 반전되어 보이는지(전면 카메라) */
  previewMirrored: boolean;
  /** 분석 결과가 도착할 때마다 호출된다. 대상이 없으면 null */
  onDetection: (result: DetectionResult | null) => void;
}

/**
 * VisionCamera 5 Frame Output → 네이티브 ML Kit 감지 → JS 콜백.
 *
 * 프레임 수명/부하 규칙
 * - 카메라 스레드(onFrame)에서는 빈도 제한만 확인하고, 분석은 AsyncRunner 스레드로 넘긴다.
 * - AsyncRunner가 바쁘면 프레임을 큐에 쌓지 않고 즉시 버린다(dispose).
 * - 네이티브 detect()는 동기 호출이라 반환 시 버퍼 참조가 끝난다 → finally에서 dispose.
 * - JS로 넘어오는 것은 좌표 등 메타데이터뿐이다. 이미지 바이트는 넘기지 않는다.
 */
export function useSubjectDetection({ kind, enabled, previewMirrored, onDetection }: Options) {
  const detector = useMemo(() => getVisionDetector(), []);
  const asyncRunner = useAsyncRunner();

  // 최신 콜백/미러 상태를 ref로 보관한다(워클릿 콜백을 다시 만들지 않기 위해).
  const onDetectionRef = useRef(onDetection);
  const mirroredRef = useRef(previewMirrored);
  useEffect(() => {
    onDetectionRef.current = onDetection;
    mirroredRef.current = previewMirrored;
  }, [onDetection, previewMirrored]);

  const deliver = useCallback((native: NativeDetection | undefined) => {
    if (native === undefined) {
      onDetectionRef.current(null);
      return;
    }
    onDetectionRef.current(
      toDetectionResult(native, { receivedAt: Date.now(), previewMirrored: mirroredRef.current }),
    );
  }, []);

  const active = enabled && kind !== null && detector !== null;
  const minIntervalMs = CompositionPolicy.analysisMinIntervalMs;

  const onFrame = useCallback(
    (frame: Frame) => {
      'worklet';
      if (!active || detector === null || kind === null) {
        frame.dispose();
        return;
      }
      // 분석 빈도 제한(약 6~7회/초). 통과하지 못한 프레임은 바로 버린다.
      if (!detector.shouldAnalyze(minIntervalMs)) {
        frame.dispose();
        return;
      }
      const handled = asyncRunner.runAsync(() => {
        'worklet';
        try {
          const result = detector.detect(frame, kind);
          scheduleOnRN(deliver, result);
        } finally {
          frame.dispose();
        }
      });
      if (!handled) {
        // 이전 분석이 아직 진행 중 → 이 프레임은 버린다.
        frame.dispose();
      }
    },
    [active, asyncRunner, deliver, detector, kind, minIntervalMs],
  );

  const frameOutput = useFrameOutput({
    // 분석 입력은 VGA(4:3)면 충분하다. 프리뷰/사진과 같은 4:3 화각을 쓴다.
    targetResolution: CommonResolutions.VGA_4_3,
    pixelFormat: 'yuv',
    dropFramesWhileBusy: true,
    onFrame,
    // 프레임 드롭은 설계상 정상 동작이므로 경고를 띄우지 않는다.
    onFrameDropped: noop,
  });

  // 분석이 꺼지면(화면 이탈·백그라운드·모드 변경) detector를 닫고 결과를 비운다.
  useEffect(() => {
    if (active) return;
    onDetectionRef.current(null);
    closeVisionDetector();
  }, [active]);

  useEffect(() => closeVisionDetector, []);

  return {
    frameOutput,
    /** 네이티브 감지기를 쓸 수 있는지 */
    detectorAvailable: detector !== null,
    /** 이 모드가 피사체 감지를 쓰는지 */
    usesDetector: kind !== null,
    getStats: () => {
      try {
        return detector?.getStats() ?? null;
      } catch {
        return null;
      }
    },
  };
}

function noop() {}

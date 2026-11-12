import { CompositionPolicy } from '../composition/composition-policy';

/**
 * 촬영된 사진 파일에서 네이티브 모듈이 실제로 계산한 값.
 * (축소 디코딩한 그레이스케일 기준)
 */
export interface PhotoMetrics {
  /** 평균 밝기 0..1 */
  meanLuminance: number;
  /** 매우 어두운 픽셀 비율 0..1 */
  darkRatio: number;
  /** 매우 밝은(날아간) 픽셀 비율 0..1 */
  brightRatio: number;
  /** 라플라시안 분산(0..255 그레이, 긴 변 약 480px 기준). 클수록 윤곽이 또렷하다. */
  sharpness: number;
}

/**
 * 판정 기준. 경험적 초기값이며 실기기 사진으로 보정해야 한다(docs/COMPOSITION_ALGORITHM.md).
 * 사진의 "품질 점수"가 아니라 눈에 띄는 문제(너무 어두움/밝음/흐림)를 알려주는 참고 표시다.
 */
export const PhotoQualityPolicy = {
  darkMean: 0.22,
  darkRatio: 0.6,
  brightMean: 0.8,
  brightRatio: 0.35,
  softSharpness: 45,
  sharpSharpness: 130,
} as const;

export type ExposureVerdict = 'dark' | 'good' | 'bright';
export type SharpnessVerdict = 'soft' | 'fair' | 'sharp';
export type LevelVerdict = 'level' | 'tilted' | 'unknown';

export interface QualityTile {
  key: 'level' | 'exposure' | 'sharpness';
  title: string;
  value: string;
  /** true = 문제 없음 */
  ok: boolean;
  /** 측정하지 못한 항목 */
  unknown: boolean;
}

export function assessExposure(metrics: PhotoMetrics): ExposureVerdict {
  if (metrics.meanLuminance < PhotoQualityPolicy.darkMean || metrics.darkRatio > PhotoQualityPolicy.darkRatio) {
    return 'dark';
  }
  if (
    metrics.meanLuminance > PhotoQualityPolicy.brightMean ||
    metrics.brightRatio > PhotoQualityPolicy.brightRatio
  ) {
    return 'bright';
  }
  return 'good';
}

export function assessSharpness(metrics: PhotoMetrics): SharpnessVerdict {
  if (metrics.sharpness < PhotoQualityPolicy.softSharpness) return 'soft';
  if (metrics.sharpness < PhotoQualityPolicy.sharpSharpness) return 'fair';
  return 'sharp';
}

/** 셔터를 누른 순간의 센서 기울기(도). 센서를 쓰지 못했으면 null */
export function assessLevel(rollDeg: number | null): LevelVerdict {
  if (rollDeg === null || !Number.isFinite(rollDeg)) return 'unknown';
  return Math.abs(rollDeg) <= CompositionPolicy.levelExitZoneDeg ? 'level' : 'tilted';
}

/** 결과 화면의 '촬영 확인' 3칸. 측정하지 못한 값은 지어내지 않고 '확인 불가'로 표시한다. */
export function buildQualityTiles(metrics: PhotoMetrics | null, rollDeg: number | null): QualityTile[] {
  const level = assessLevel(rollDeg);
  const levelTile: QualityTile = {
    key: 'level',
    title: '수평',
    value: level === 'unknown' ? '확인 불가' : level === 'level' ? '맞음' : `${Math.abs(rollDeg ?? 0).toFixed(0)}° 기울어짐`,
    ok: level === 'level',
    unknown: level === 'unknown',
  };

  if (metrics === null) {
    return [
      levelTile,
      { key: 'exposure', title: '노출', value: '확인 불가', ok: false, unknown: true },
      { key: 'sharpness', title: '선명도', value: '확인 불가', ok: false, unknown: true },
    ];
  }

  const exposure = assessExposure(metrics);
  const sharpness = assessSharpness(metrics);
  return [
    levelTile,
    {
      key: 'exposure',
      title: '노출',
      value: exposure === 'good' ? '적절' : exposure === 'dark' ? '어두움' : '밝음',
      ok: exposure === 'good',
      unknown: false,
    },
    {
      key: 'sharpness',
      title: '선명도',
      value: sharpness === 'sharp' ? '선명' : sharpness === 'fair' ? '보통' : '흐림',
      ok: sharpness !== 'soft',
      unknown: false,
    },
  ];
}

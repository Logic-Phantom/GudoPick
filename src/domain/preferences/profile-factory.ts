import { CompositionPolicy } from '../composition/composition-policy';
import type {
  AspectRatioPreset,
  CompositionProfile,
  GridKind,
  GuidanceIntensity,
  NegativeSpace,
  Point,
  ShootingMode,
  SubjectScaleRange,
} from '../composition/types';

/** 온보딩/프리셋 편집에서 사용자가 고르는 값 */
export type CompositionStyle = 'center' | 'thirds' | 'negative' | 'closeup';
export type SubjectPlacement = 'center' | 'left' | 'right' | 'top' | 'bottom';
export type SubjectSize = 'small' | 'normal' | 'large';

export interface PreferenceAnswers {
  mode: ShootingMode;
  style: CompositionStyle;
  placement: SubjectPlacement;
  size: SubjectSize;
  aspectRatio: AspectRatioPreset;
  guidanceIntensity: GuidanceIntensity;
  levelGuide: boolean;
}

export const DEFAULT_ANSWERS: PreferenceAnswers = {
  mode: 'portrait',
  style: 'thirds',
  placement: 'center',
  size: 'normal',
  aspectRatio: '3:4',
  guidanceIntensity: 'normal',
  levelGuide: true,
};

/** 구도 스타일을 고르면 위치/크기의 기본 추천값이 따라온다 (사용자가 다음 단계에서 바꿀 수 있다). */
export function suggestedPlacementAndSize(
  style: CompositionStyle,
): Pick<PreferenceAnswers, 'placement' | 'size'> {
  switch (style) {
    case 'center':
      return { placement: 'center', size: 'normal' };
    case 'thirds':
      return { placement: 'left', size: 'normal' };
    case 'negative':
      return { placement: 'left', size: 'small' };
    case 'closeup':
      return { placement: 'center', size: 'large' };
  }
}

const THIRD = 1 / 3;

/** 스타일별로 중심에서 얼마나 치우치게 둘지 (0.5 기준 오프셋) */
function offsetFor(style: CompositionStyle): number {
  switch (style) {
    case 'thirds':
      return 0.5 - THIRD; // 3분할선 위
    case 'negative':
      return 0.22; // 3분할보다 더 가장자리 쪽 → 반대편 여백이 넓어진다
    case 'center':
    case 'closeup':
      return 0.14; // 살짝만 치우침
  }
}

export function computeTargetAnchor(
  mode: ShootingMode,
  style: CompositionStyle,
  placement: SubjectPlacement,
): Point {
  const offset = offsetFor(style);
  let x = 0.5;
  let y = 0.5;

  switch (placement) {
    case 'left':
      x = 0.5 - offset;
      break;
    case 'right':
      x = 0.5 + offset;
      break;
    case 'top':
      y = 0.5 - offset;
      break;
    case 'bottom':
      y = 0.5 + offset;
      break;
    case 'center':
      break;
  }

  // 인물: 얼굴은 화면 중앙보다 위(상단 3분할 근처)에 두는 것이 기본이다.
  // 사용자가 위/아래를 직접 고른 경우에는 그 선택을 그대로 따른다.
  if (placement !== 'top' && placement !== 'bottom') {
    if (mode === 'portrait') y = style === 'closeup' ? 0.42 : 0.38;
    // OOTD: 얼굴만 감지하므로, 전신이 들어오도록 얼굴을 프레임 위쪽에 둔다.
    if (mode === 'ootd') y = 0.2;
  } else if (mode === 'ootd' && placement === 'top') {
    y = 0.16;
  }

  return { x: round(x), y: round(y) };
}

/** 모드·크기 선택에 따른 목표 크기 범위. 값 = sqrt(가로비율×세로비율), 크롭 프레임 기준 */
export function computeTargetScale(mode: ShootingMode, size: SubjectSize, style: CompositionStyle): SubjectScaleRange {
  const table: Record<ShootingMode, Record<SubjectSize, number>> = {
    // 얼굴 박스 기준
    portrait: { small: 0.16, normal: 0.26, large: 0.4 },
    // 주요 객체 박스 기준
    food: { small: 0.32, normal: 0.5, large: 0.7 },
    // 풍경은 피사체 감지를 쓰지 않는다 (값은 형식상 유지)
    landscape: { small: 0.3, normal: 0.5, large: 0.7 },
    // 전신 프레이밍에서의 얼굴 크기
    ootd: { small: 0.07, normal: 0.1, large: 0.14 },
  };
  let ideal = table[mode][size];
  if (style === 'closeup' && size !== 'large') ideal *= 1.15;
  if (style === 'negative' && size !== 'small') ideal *= 0.9;

  const spread = mode === 'ootd' ? 0.35 : 0.25;
  return {
    min: round(ideal * (1 - spread)),
    ideal: round(ideal),
    max: round(ideal * (1 + spread)),
  };
}

export function computeNegativeSpace(style: CompositionStyle, placement: SubjectPlacement): NegativeSpace {
  // 중앙 배치는 여백 방향이 없다.
  if (placement === 'center') return 'none';
  // 살짝만 치우치는 스타일은 여백 안내를 하지 않는다.
  if (style === 'center' || style === 'closeup') return 'none';
  switch (placement) {
    case 'left':
      return 'right';
    case 'right':
      return 'left';
    case 'top':
      return 'bottom';
    case 'bottom':
      return 'top';
  }
}

export function computeGrid(style: CompositionStyle, intensity: GuidanceIntensity): GridKind {
  if (intensity === 'subtle') return 'none';
  return style === 'thirds' || style === 'negative' ? 'thirds' : 'center';
}

export function holdDurationFor(intensity: GuidanceIntensity): number {
  switch (intensity) {
    case 'subtle':
      return CompositionPolicy.defaultHoldDurationMs - 200;
    case 'normal':
      return CompositionPolicy.defaultHoldDurationMs;
    case 'strong':
      return CompositionPolicy.defaultHoldDurationMs + 200;
  }
}

/**
 * 취향 선택 → 카메라 가이드에 쓰는 CompositionProfile.
 * 순수 함수: 같은 입력이면 항상 같은 결과.
 */
export function createProfileFromAnswers(
  answers: PreferenceAnswers,
  meta: { id: string; name: string },
): CompositionProfile {
  return {
    id: meta.id,
    name: meta.name,
    mode: answers.mode,
    aspectRatio: answers.aspectRatio,
    targetAnchor: computeTargetAnchor(answers.mode, answers.style, answers.placement),
    targetSubjectScale: computeTargetScale(answers.mode, answers.size, answers.style),
    negativeSpace: computeNegativeSpace(answers.style, answers.placement),
    grid: computeGrid(answers.style, answers.guidanceIntensity),
    levelGuide: answers.levelGuide,
    guidanceIntensity: answers.guidanceIntensity,
    holdDurationMs: holdDurationFor(answers.guidanceIntensity),
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

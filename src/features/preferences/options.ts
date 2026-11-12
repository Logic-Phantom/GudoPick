import type { AspectRatioPreset, GuidanceIntensity, ShootingMode } from '@/domain/composition/types';
import type { CompositionStyle, SubjectPlacement, SubjectSize } from '@/domain/preferences/profile-factory';
import type { SampleImageKey } from '@/shared/sample-images';

/** 온보딩과 프리셋 편집에서 공통으로 쓰는 선택지 정의 (라벨·예시 이미지) */

export const MODE_OPTIONS: readonly { value: ShootingMode; label: string; image: SampleImageKey; note: string }[] = [
  { value: 'portrait', label: '인물', image: 'portrait_seaside_profile', note: '얼굴 위치와 크기를 안내해요' },
  { value: 'food', label: '음식·카페', image: 'food_cafe_brunch_overhead', note: '주요 사물의 위치와 크기를 안내해요' },
  { value: 'landscape', label: '여행·풍경', image: 'landscape_lighthouse_coast', note: '수평과 격자 가이드를 제공해요' },
  { value: 'ootd', label: 'OOTD', image: 'ootd_back_view_minimal', note: '얼굴 위치 기준으로 프레이밍을 안내해요' },
];

export const STYLE_OPTIONS: readonly { value: CompositionStyle; label: string; image: SampleImageKey }[] = [
  { value: 'center', label: '중앙 집중', image: 'landscape_sunset_horizon' },
  { value: 'thirds', label: '3분할', image: 'landscape_sunset_rocky_coast' },
  { value: 'negative', label: '여백 있는', image: 'portrait_back_view_sunset' },
  { value: 'closeup', label: '클로즈업', image: 'food_pasta_closeup' },
];

export const PLACEMENT_OPTIONS: readonly { value: SubjectPlacement; label: string }[] = [
  { value: 'center', label: '중앙' },
  { value: 'left', label: '왼쪽' },
  { value: 'right', label: '오른쪽' },
  { value: 'top', label: '위쪽' },
  { value: 'bottom', label: '아래쪽' },
];

export const SIZE_OPTIONS: readonly { value: SubjectSize; label: string }[] = [
  { value: 'small', label: '여유 있게 작게' },
  { value: 'normal', label: '보통' },
  { value: 'large', label: '가까이 크게' },
];

export const RATIO_OPTIONS: readonly { value: AspectRatioPreset; label: string; note: string }[] = [
  { value: '1:1', label: '1:1', note: '정사각' },
  { value: '4:5', label: '4:5', note: '세로 피드' },
  { value: '3:4', label: '3:4', note: '기본 사진' },
  { value: '9:16', label: '9:16', note: '세로 전체' },
];

export const INTENSITY_OPTIONS: readonly { value: GuidanceIntensity; label: string; note: string }[] = [
  { value: 'subtle', label: '최소', note: '목표 위치만 표시' },
  { value: 'normal', label: '기본', note: '격자·피사체 박스·안내 문구' },
  { value: 'strong', label: '자세히', note: '방향 화살표까지 표시' },
];

export function modeLabel(mode: ShootingMode): string {
  return MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}

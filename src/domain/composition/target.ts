import { clamp } from './geometry';
import type { CompositionProfile, NormalizedRect, ShootingMode } from './types';

/** 이 모드가 피사체 감지를 쓰는지, 쓴다면 어떤 detector인지 */
export function detectorKindForMode(mode: ShootingMode): 'face' | 'object' | null {
  switch (mode) {
    case 'portrait':
    case 'ootd':
      return 'face';
    case 'food':
      return 'object';
    case 'landscape':
      // 풍경은 센서 기반 수평 + 그리드만 제공한다. 지평선 인식은 하지 않는다.
      return null;
  }
}

/**
 * 프로필의 목표 중심·크기로부터 크롭 프레임 기준 목표 영역(고스트 가이드)을 만든다.
 * `subjectAspect`는 현재 피사체 박스의 가로/세로 비(없으면 모드 기본값)를 뜻한다.
 */
export function computeTargetBounds(
  profile: CompositionProfile,
  cropAspect: number,
  subjectAspect?: number,
): NormalizedRect {
  const scale = profile.targetSubjectScale.ideal;
  // 피사체의 실제(픽셀) 가로/세로 비 → 정규 좌표계(크롭 프레임 비율 반영)로 환산
  const pixelAspect = clamp(subjectAspect ?? defaultSubjectAspect(profile.mode), 0.4, 2.5);
  const normalizedAspect = pixelAspect / cropAspect; // (w/W)/(h/H)

  // sqrt(w*h) = scale, w/h = normalizedAspect
  let width = scale * Math.sqrt(normalizedAspect);
  let height = scale / Math.sqrt(normalizedAspect);
  width = Math.min(width, 0.96);
  height = Math.min(height, 0.96);

  const x = clamp(profile.targetAnchor.x - width / 2, 0.02, 0.98 - width);
  const y = clamp(profile.targetAnchor.y - height / 2, 0.02, 0.98 - height);
  return { x, y, width, height };
}

function defaultSubjectAspect(mode: ShootingMode): number {
  switch (mode) {
    case 'portrait':
    case 'ootd':
      return 0.85; // 얼굴 박스는 세로로 약간 길다
    case 'food':
    case 'landscape':
      return 1;
  }
}

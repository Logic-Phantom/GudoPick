import type { AspectRatioPreset, CompositionProfile, GuidanceIntensity, ShootingMode } from '../composition/types';
import {
  createProfileFromAnswers,
  DEFAULT_ANSWERS,
  type CompositionStyle,
  type PreferenceAnswers,
  type SubjectPlacement,
  type SubjectSize,
} from './profile-factory';

/** 저장되는 취향 답변 스키마 버전. 필드가 바뀌면 올리고 `migrateAnswers`에 변환을 추가한다. */
export const ANSWERS_VERSION = 2;

export interface Preset {
  id: string;
  name: string;
  answers: PreferenceAnswers;
  /** 번들된 샘플 이미지 키 (src/shared/sample-images.ts) */
  coverKey: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export function presetToProfile(preset: Preset): CompositionProfile {
  return createProfileFromAnswers(preset.answers, { id: preset.id, name: preset.name });
}

const MODES: readonly ShootingMode[] = ['portrait', 'food', 'landscape', 'ootd'];
const STYLES: readonly CompositionStyle[] = ['center', 'thirds', 'negative', 'closeup'];
const PLACEMENTS: readonly SubjectPlacement[] = ['center', 'left', 'right', 'top', 'bottom'];
const SIZES: readonly SubjectSize[] = ['small', 'normal', 'large'];
const RATIOS: readonly AspectRatioPreset[] = ['1:1', '4:5', '3:4', '9:16'];
const INTENSITIES: readonly GuidanceIntensity[] = ['subtle', 'normal', 'strong'];

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * 저장된 답변(JSON)을 현재 스키마로 변환한다.
 * 알 수 없는 값·누락된 값은 기본값으로 대체해 앱이 깨지지 않게 한다.
 *
 * - v1: `size` 없음, 클로즈업 여부를 `closeUp: boolean`으로 저장, `levelGuide` 이름이 `level`
 * - v2: 현재 스키마
 */
export function migrateAnswers(raw: unknown, fromVersion: number): PreferenceAnswers {
  const source: Record<string, unknown> =
    raw !== null && typeof raw === 'object' ? { ...(raw as Record<string, unknown>) } : {};

  if (fromVersion < 2) {
    if (source.size === undefined) source.size = source.closeUp === true ? 'large' : 'normal';
    if (source.levelGuide === undefined && typeof source.level === 'boolean') source.levelGuide = source.level;
  }

  return {
    mode: pick(source.mode, MODES, DEFAULT_ANSWERS.mode),
    style: pick(source.style, STYLES, DEFAULT_ANSWERS.style),
    placement: pick(source.placement, PLACEMENTS, DEFAULT_ANSWERS.placement),
    size: pick(source.size, SIZES, DEFAULT_ANSWERS.size),
    aspectRatio: pick(source.aspectRatio, RATIOS, DEFAULT_ANSWERS.aspectRatio),
    guidanceIntensity: pick(source.guidanceIntensity, INTENSITIES, DEFAULT_ANSWERS.guidanceIntensity),
    levelGuide: typeof source.levelGuide === 'boolean' ? source.levelGuide : DEFAULT_ANSWERS.levelGuide,
  };
}

export interface PresetSeed {
  name: string;
  coverKey: string;
  answers: PreferenceAnswers;
}

/** 처음 실행 시 넣어 두는 예시 프리셋. 사용자가 수정·삭제할 수 있다. */
export const BUILTIN_PRESET_SEEDS: readonly PresetSeed[] = [
  {
    name: '카페 감성',
    coverKey: 'cafe_window_table',
    answers: {
      mode: 'food',
      style: 'thirds',
      placement: 'left',
      size: 'normal',
      aspectRatio: '4:5',
      guidanceIntensity: 'normal',
      levelGuide: false,
    },
  },
  {
    name: '일몰 감성',
    coverKey: 'landscape_sunset_horizon',
    answers: {
      mode: 'landscape',
      style: 'thirds',
      placement: 'center',
      size: 'normal',
      aspectRatio: '1:1',
      guidanceIntensity: 'normal',
      levelGuide: true,
    },
  },
  {
    name: '인물 중심',
    coverKey: 'portrait_seaside_closeup',
    answers: {
      mode: 'portrait',
      style: 'center',
      placement: 'center',
      size: 'normal',
      aspectRatio: '3:4',
      guidanceIntensity: 'normal',
      levelGuide: true,
    },
  },
  {
    name: '여행 풍경',
    coverKey: 'travel_seoul_skyline_dusk',
    answers: {
      mode: 'landscape',
      style: 'negative',
      placement: 'bottom',
      size: 'small',
      aspectRatio: '9:16',
      guidanceIntensity: 'normal',
      levelGuide: true,
    },
  },
];

/** 온보딩을 건너뛰었을 때 기본으로 선택되는 예시 프리셋 이름 */
export const SKIP_DEFAULT_PRESET_NAME = '일몰 감성';

export function coverKeyForMode(mode: ShootingMode): string {
  switch (mode) {
    case 'portrait':
      return 'portrait_seaside_profile';
    case 'food':
      return 'food_cafe_brunch_overhead';
    case 'landscape':
      return 'landscape_lighthouse_coast';
    case 'ootd':
      return 'ootd_back_view_minimal';
  }
}

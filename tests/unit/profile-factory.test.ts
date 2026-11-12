import { CompositionPolicy } from '@/domain/composition/composition-policy';
import { computeTargetBounds, detectorKindForMode } from '@/domain/composition/target';
import { ANSWERS_VERSION, BUILTIN_PRESET_SEEDS, migrateAnswers, presetToProfile } from '@/domain/preferences/preset';
import {
  computeGrid,
  computeNegativeSpace,
  computeTargetAnchor,
  computeTargetScale,
  createProfileFromAnswers,
  DEFAULT_ANSWERS,
  suggestedPlacementAndSize,
  type PreferenceAnswers,
} from '@/domain/preferences/profile-factory';

const meta = { id: 'p1', name: '테스트' };
const answers = (patch: Partial<PreferenceAnswers>): PreferenceAnswers => ({ ...DEFAULT_ANSWERS, ...patch });

describe('취향 → CompositionProfile', () => {
  it('같은 입력이면 항상 같은 프로필을 만든다(순수 함수)', () => {
    const a = createProfileFromAnswers(DEFAULT_ANSWERS, meta);
    const b = createProfileFromAnswers({ ...DEFAULT_ANSWERS }, meta);
    expect(a).toEqual(b);
  });

  it('왼쪽 배치는 목표 중심을 왼쪽으로, 여백을 오른쪽으로 둔다', () => {
    const profile = createProfileFromAnswers(answers({ mode: 'food', style: 'negative', placement: 'left' }), meta);
    expect(profile.targetAnchor.x).toBeLessThan(0.4);
    expect(profile.negativeSpace).toBe('right');
  });

  it('오른쪽·위·아래 배치도 각각 반대편에 여백을 둔다', () => {
    expect(computeNegativeSpace('thirds', 'right')).toBe('left');
    expect(computeNegativeSpace('negative', 'top')).toBe('bottom');
    expect(computeNegativeSpace('negative', 'bottom')).toBe('top');
    expect(computeNegativeSpace('thirds', 'center')).toBe('none');
    expect(computeNegativeSpace('center', 'left')).toBe('none');
  });

  it('3분할 스타일은 3분할선 위에 목표를 둔다', () => {
    const left = computeTargetAnchor('food', 'thirds', 'left');
    const right = computeTargetAnchor('food', 'thirds', 'right');
    expect(left.x).toBeCloseTo(1 / 3, 2);
    expect(right.x).toBeCloseTo(2 / 3, 2);
    expect(computeTargetAnchor('food', 'thirds', 'top').y).toBeCloseTo(1 / 3, 2);
    expect(computeTargetAnchor('food', 'thirds', 'bottom').y).toBeCloseTo(2 / 3, 2);
  });

  it('여백 스타일은 3분할보다 더 가장자리 쪽에 둔다', () => {
    const thirds = computeTargetAnchor('food', 'thirds', 'left');
    const negative = computeTargetAnchor('food', 'negative', 'left');
    expect(negative.x).toBeLessThan(thirds.x);
  });

  it('중앙 배치(음식)는 정중앙이다', () => {
    expect(computeTargetAnchor('food', 'center', 'center')).toEqual({ x: 0.5, y: 0.5 });
  });

  it('인물은 얼굴을 중앙보다 위에, OOTD는 더 위에 둔다', () => {
    const portrait = computeTargetAnchor('portrait', 'center', 'center');
    const ootd = computeTargetAnchor('ootd', 'center', 'center');
    expect(portrait.y).toBeLessThan(0.5);
    expect(ootd.y).toBeLessThan(portrait.y);
  });

  it('크기 선택이 목표 크기 범위에 반영된다', () => {
    const small = computeTargetScale('portrait', 'small', 'center');
    const normal = computeTargetScale('portrait', 'normal', 'center');
    const large = computeTargetScale('portrait', 'large', 'center');
    expect(small.ideal).toBeLessThan(normal.ideal);
    expect(normal.ideal).toBeLessThan(large.ideal);
    for (const range of [small, normal, large]) {
      expect(range.min).toBeLessThan(range.ideal);
      expect(range.ideal).toBeLessThan(range.max);
    }
  });

  it('클로즈업은 같은 크기 선택에서도 더 크게 잡는다', () => {
    expect(computeTargetScale('food', 'normal', 'closeup').ideal).toBeGreaterThan(
      computeTargetScale('food', 'normal', 'center').ideal,
    );
  });

  it('비율·수평·강도 선택이 프로필에 그대로 들어간다', () => {
    const profile = createProfileFromAnswers(
      answers({ aspectRatio: '9:16', levelGuide: false, guidanceIntensity: 'strong' }),
      meta,
    );
    expect(profile.aspectRatio).toBe('9:16');
    expect(profile.levelGuide).toBe(false);
    expect(profile.guidanceIntensity).toBe('strong');
    expect(profile.holdDurationMs).toBeGreaterThan(CompositionPolicy.defaultHoldDurationMs);
  });

  it('가이드 강도 최소는 격자를 끄고, 그 외에는 스타일에 맞는 격자를 쓴다', () => {
    expect(computeGrid('thirds', 'subtle')).toBe('none');
    expect(computeGrid('thirds', 'normal')).toBe('thirds');
    expect(computeGrid('negative', 'strong')).toBe('thirds');
    expect(computeGrid('center', 'normal')).toBe('center');
    expect(computeGrid('closeup', 'normal')).toBe('center');
  });

  it('구도 스타일을 고르면 위치/크기 추천값이 따라온다', () => {
    expect(suggestedPlacementAndSize('closeup')).toEqual({ placement: 'center', size: 'large' });
    expect(suggestedPlacementAndSize('negative').size).toBe('small');
  });
});

describe('목표 영역(고스트 가이드)', () => {
  it('목표 중심과 크기를 프로필에서 그대로 가져온다', () => {
    const profile = createProfileFromAnswers(answers({ mode: 'food', style: 'center', placement: 'center' }), meta);
    const bounds = computeTargetBounds(profile, 1, 1);
    expect(bounds.x + bounds.width / 2).toBeCloseTo(0.5, 3);
    expect(bounds.y + bounds.height / 2).toBeCloseTo(0.5, 3);
    expect(Math.sqrt(bounds.width * bounds.height)).toBeCloseTo(profile.targetSubjectScale.ideal, 3);
  });

  it('프레임 밖으로 나가지 않는다', () => {
    const profile = createProfileFromAnswers(
      answers({ mode: 'food', style: 'negative', placement: 'left', size: 'large' }),
      meta,
    );
    for (const aspect of [1, 4 / 5, 3 / 4, 9 / 16]) {
      const bounds = computeTargetBounds(profile, aspect);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(1);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(1);
    }
  });

  it('모드별 detector 종류', () => {
    expect(detectorKindForMode('portrait')).toBe('face');
    expect(detectorKindForMode('ootd')).toBe('face');
    expect(detectorKindForMode('food')).toBe('object');
    expect(detectorKindForMode('landscape')).toBeNull();
  });
});

describe('저장된 취향 마이그레이션', () => {
  it('현재 버전은 값이 그대로 유지된다', () => {
    const current = answers({ mode: 'ootd', style: 'negative', placement: 'right', size: 'small' });
    expect(migrateAnswers(JSON.parse(JSON.stringify(current)), ANSWERS_VERSION)).toEqual(current);
  });

  it('v1(closeUp/level) 데이터를 v2로 변환한다', () => {
    const migrated = migrateAnswers(
      { mode: 'food', style: 'center', placement: 'left', closeUp: true, level: false, aspectRatio: '1:1', guidanceIntensity: 'subtle' },
      1,
    );
    expect(migrated.size).toBe('large');
    expect(migrated.levelGuide).toBe(false);
    expect(migrated.mode).toBe('food');
    expect(migrated.aspectRatio).toBe('1:1');
  });

  it('깨졌거나 알 수 없는 값은 기본값으로 대체한다', () => {
    expect(migrateAnswers(null, 2)).toEqual(DEFAULT_ANSWERS);
    expect(migrateAnswers('oops', 1)).toEqual(DEFAULT_ANSWERS);
    const migrated = migrateAnswers({ mode: 'video', aspectRatio: '16:9', levelGuide: 'yes' }, 2);
    expect(migrated.mode).toBe(DEFAULT_ANSWERS.mode);
    expect(migrated.aspectRatio).toBe(DEFAULT_ANSWERS.aspectRatio);
    expect(migrated.levelGuide).toBe(DEFAULT_ANSWERS.levelGuide);
  });

  it('예시 프리셋은 모두 유효한 프로필로 변환된다', () => {
    BUILTIN_PRESET_SEEDS.forEach((seed, index) => {
      const profile = presetToProfile({
        id: `seed-${index}`,
        name: seed.name,
        answers: seed.answers,
        coverKey: seed.coverKey,
        isDefault: false,
        sortOrder: index,
        createdAt: 0,
        updatedAt: 0,
      });
      expect(profile.name).toBe(seed.name);
      expect(profile.targetAnchor.x).toBeGreaterThan(0);
      expect(profile.targetAnchor.x).toBeLessThan(1);
      expect(profile.targetSubjectScale.min).toBeGreaterThan(0);
    });
  });
});

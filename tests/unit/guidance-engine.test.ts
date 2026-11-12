import { CompositionPolicy } from '@/domain/composition/composition-policy';
import { GuidanceEngine, type GuidanceInput } from '@/domain/composition/guidance-engine';
import { isLevel, rollFromGravity } from '@/domain/composition/level';
import { GuidanceMessages, moveMessage } from '@/domain/composition/messages';
import type { CompositionProfile, NormalizedRect } from '@/domain/composition/types';
import { createProfileFromAnswers, DEFAULT_ANSWERS } from '@/domain/preferences/profile-factory';

function profileOf(patch: Partial<typeof DEFAULT_ANSWERS> = {}): CompositionProfile {
  return createProfileFromAnswers(
    { ...DEFAULT_ANSWERS, mode: 'food', style: 'center', placement: 'center', levelGuide: false, ...patch },
    { id: 'p', name: '테스트' },
  );
}

/** 중심·크기(sqrt 면적)로 정사각 박스를 만든다 */
function box(cx: number, cy: number, scale: number): NormalizedRect {
  return { x: cx - scale / 2, y: cy - scale / 2, width: scale, height: scale };
}

class Harness {
  now = 10_000;
  readonly engine: GuidanceEngine;
  constructor(readonly profile: CompositionProfile) {
    this.engine = new GuidanceEngine(profile);
  }
  /** 새 분석 결과가 도착한 것처럼 한 번 평가한다 */
  step(bounds: NormalizedRect | null, extra: Partial<GuidanceInput> & { confidence?: number; trackingId?: number } = {}, dt = 150) {
    this.now += dt;
    const { confidence, trackingId, ...input } = extra;
    return this.engine.update({
      now: this.now,
      subject: bounds ? { bounds, timestamp: this.now, confidence, trackingId } : null,
      rollDeg: null,
      detectorAvailable: true,
      cropAspect: 1,
      ...input,
    });
  }
  /** 같은 위치로 여러 번 평가해 평활화가 수렴하게 한다 */
  settle(bounds: NormalizedRect, times = 12, extra: Partial<GuidanceInput> = {}) {
    let result = this.step(bounds, extra);
    for (let i = 1; i < times; i += 1) result = this.step(bounds, extra);
    return result;
  }
}

describe('GuidanceEngine: 탐색/유실', () => {
  it('처음에는 피사체를 찾는 중이다', () => {
    const h = new Harness(profileOf());
    const result = h.step(null);
    expect(result.status).toBe('searching');
    expect(result.reasonCode).toBe('searching');
    expect(result.message).toBe(GuidanceMessages.searchingObject);
    expect(result.currentBounds).toBeUndefined();
    expect(result.targetBounds).toBeUndefined();
  });

  it('인물 모드는 얼굴을 찾는다고 안내한다', () => {
    const h = new Harness(profileOf({ mode: 'portrait' }));
    expect(h.step(null).message).toBe(GuidanceMessages.searchingFace);
  });

  it('탐지가 사라지면 유예 시간 동안만 이전 결과를 유지하고 그 뒤 해제한다', () => {
    const h = new Harness(profileOf());
    h.settle(box(0.5, 0.5, 0.5));
    // 유예 시간 안: 박스 유지
    const within = h.step(null, {}, CompositionPolicy.detectionGraceMs - 100);
    expect(within.currentBounds).toBeDefined();
    // 유예 시간 초과: 박스 해제 + 안내 복귀
    const after = h.step(null, {}, 300);
    expect(after.status).toBe('searching');
    expect(after.reasonCode).toBe('subject-lost');
    expect(after.message).toBe(GuidanceMessages.lost);
    expect(after.currentBounds).toBeUndefined();
  });

  it('오래된 분석 결과는 무시한다', () => {
    const h = new Harness(profileOf());
    const stale = h.engine.update({
      now: 50_000,
      subject: { bounds: box(0.5, 0.5, 0.5), timestamp: 50_000 - CompositionPolicy.staleResultMs - 1 },
      rollDeg: null,
      detectorAvailable: true,
      cropAspect: 1,
    });
    expect(stale.status).toBe('searching');
    expect(stale.currentBounds).toBeUndefined();
  });

  it('신뢰도가 낮으면 unavailable로 처리하고 박스를 그리지 않는다', () => {
    const h = new Harness(profileOf());
    const result = h.step(box(0.5, 0.5, 0.5), { confidence: CompositionPolicy.minConfidence - 0.1 });
    expect(result.status).toBe('unavailable');
    expect(result.reasonCode).toBe('low-confidence');
    expect(result.currentBounds).toBeUndefined();
  });

  it('신뢰도 값이 없거나(ML Kit 기본) 충분하면 사용한다', () => {
    const h = new Harness(profileOf());
    expect(h.step(box(0.5, 0.5, 0.5)).currentBounds).toBeDefined();
    expect(h.step(box(0.5, 0.5, 0.5), { confidence: 0.9 }).currentBounds).toBeDefined();
  });

  it('detector를 쓸 수 없으면 unavailable + 수동 가이드 안내', () => {
    const h = new Harness(profileOf());
    const result = h.step(box(0.5, 0.5, 0.5), { detectorAvailable: false });
    expect(result.status).toBe('unavailable');
    expect(result.reasonCode).toBe('detector-unavailable');
    expect(result.message).toBe(GuidanceMessages.detectorUnavailable);
  });
});

describe('GuidanceEngine: 방향 안내', () => {
  it('피사체가 목표보다 오른쪽이면 왼쪽으로, 왼쪽이면 오른쪽으로 안내한다', () => {
    const right = new Harness(profileOf()).settle(box(0.8, 0.5, 0.5));
    expect(right.status).toBe('adjusting');
    expect(right.direction).toBe('left');
    const left = new Harness(profileOf()).settle(box(0.2, 0.5, 0.5));
    expect(left.direction).toBe('right');
  });

  it('위/아래도 같은 규칙이다', () => {
    expect(new Harness(profileOf()).settle(box(0.5, 0.8, 0.5)).direction).toBe('up');
    expect(new Harness(profileOf()).settle(box(0.5, 0.2, 0.5)).direction).toBe('down');
  });

  it('위치가 맞으면 크기를 안내한다: 작으면 가까이, 크면 멀리', () => {
    const profile = profileOf();
    const small = new Harness(profile).settle(box(0.5, 0.5, profile.targetSubjectScale.min * 0.5));
    expect(small.direction).toBe('closer');
    expect(small.message).toBe(GuidanceMessages.closer);
    const large = new Harness(profile).settle(box(0.5, 0.5, Math.min(profile.targetSubjectScale.max * 1.5, 0.95)));
    expect(large.direction).toBe('farther');
  });

  it('여백 프로필에서는 여백 중심 문구를 쓴다', () => {
    const profile = profileOf({ style: 'negative', placement: 'left' });
    expect(profile.negativeSpace).toBe('right');
    const result = new Harness(profile).settle(box(0.8, 0.5, profile.targetSubjectScale.ideal));
    expect(result.direction).toBe('left');
    expect(result.message).toBe('오른쪽에 여백을 두세요');
    expect(moveMessage('right', 'right')).toBe('피사체를 오른쪽 가이드에 맞춰 보세요.');
  });

  it('목표·현재 영역을 함께 돌려준다', () => {
    const result = new Harness(profileOf()).settle(box(0.8, 0.5, 0.5));
    expect(result.targetBounds).toBeDefined();
    expect(result.currentBounds).toBeDefined();
    expect(result.alignment).toBeGreaterThanOrEqual(0);
    expect(result.alignment).toBeLessThan(1);
  });
});

describe('GuidanceEngine: dead zone / 히스테리시스 / 평활화', () => {
  it('허용 오차 안이면 방향 안내를 하지 않는다', () => {
    const profile = profileOf();
    const offset = CompositionPolicy.positionDeadZone * 0.8;
    const result = new Harness(profile).settle(box(0.5 + offset, 0.5, profile.targetSubjectScale.ideal));
    expect(result.direction).toBeUndefined();
    expect(['almost', 'ready']).toContain(result.status);
  });

  it('한번 맞은 뒤에는 exit zone을 벗어나야 다시 안내한다', () => {
    const profile = profileOf();
    const ideal = profile.targetSubjectScale.ideal;
    const h = new Harness(profile);
    h.settle(box(0.5, 0.5, ideal));
    // dead zone과 exit zone 사이: 여전히 맞은 상태
    const between = (CompositionPolicy.positionDeadZone + CompositionPolicy.positionExitZone) / 2;
    expect(h.settle(box(0.5 + between, 0.5, ideal)).direction).toBeUndefined();
    // exit zone 밖: 안내 재개
    expect(h.settle(box(0.5 + CompositionPolicy.positionExitZone * 1.6, 0.5, ideal)).direction).toBe('left');
  });

  it('맞지 않은 상태에서 dead zone과 exit zone 사이로 들어오면 아직 맞지 않은 것으로 본다', () => {
    const profile = profileOf();
    const ideal = profile.targetSubjectScale.ideal;
    const h = new Harness(profile);
    h.settle(box(0.8, 0.5, ideal));
    const between = (CompositionPolicy.positionDeadZone + CompositionPolicy.positionExitZone) / 2;
    expect(h.settle(box(0.5 + between, 0.5, ideal)).status).toBe('adjusting');
  });

  it('박스는 EMA로 평활화되어 한 번에 튀지 않는다', () => {
    const h = new Harness(profileOf());
    h.settle(box(0.3, 0.5, 0.5));
    const jumped = h.step(box(0.7, 0.5, 0.5));
    const center = jumped.currentBounds!.x + jumped.currentBounds!.width / 2;
    expect(center).toBeGreaterThan(0.3);
    expect(center).toBeLessThan(0.7);
    expect(center).toBeCloseTo(0.3 + 0.4 * CompositionPolicy.smoothingAlpha, 5);
  });

  it('같은 관측값을 다시 평가해도 평활화를 중복 적용하지 않는다', () => {
    const h = new Harness(profileOf());
    h.settle(box(0.3, 0.5, 0.5));
    const first = h.step(box(0.7, 0.5, 0.5));
    // 새 분석 결과 없이 타이머로 다시 평가 (같은 timestamp)
    const again = h.engine.update({
      now: h.now + 50,
      subject: { bounds: box(0.7, 0.5, 0.5), timestamp: h.now },
      rollDeg: null,
      detectorAvailable: true,
      cropAspect: 1,
    });
    expect(again.currentBounds!.x).toBeCloseTo(first.currentBounds!.x, 8);
  });

  it('추적 대상이 바뀌면 평활화를 초기화한다', () => {
    const h = new Harness(profileOf());
    h.settle(box(0.3, 0.5, 0.5), 6, {});
    h.step(box(0.3, 0.5, 0.5), { trackingId: 1 });
    const switched = h.step(box(0.7, 0.5, 0.5), { trackingId: 2 });
    expect(switched.currentBounds!.x + switched.currentBounds!.width / 2).toBeCloseTo(0.7, 5);
  });

  it('안내 방향은 새 방향이 일정 시간 유지되어야 바뀐다(문구 깜박임 방지)', () => {
    const profile = profileOf();
    const policy = { ...CompositionPolicy, smoothingAlpha: 1 as number } as typeof CompositionPolicy;
    const engine = new GuidanceEngine(profile, policy);
    const ideal = profile.targetSubjectScale.ideal;
    let now = 1000;
    const feed = (cx: number, dt: number) => {
      now += dt;
      return engine.update({
        now,
        subject: { bounds: box(cx, 0.5, ideal), timestamp: now },
        rollDeg: null,
        detectorAvailable: true,
        cropAspect: 1,
      });
    };
    expect(feed(0.8, 100).direction).toBe('left');
    // 한 프레임만 반대쪽으로 튄 경우: 문구 유지
    expect(feed(0.2, 100).direction).toBe('left');
    expect(feed(0.8, 100).direction).toBe('left');
    // 반대쪽이 계속 유지되면 전환
    expect(feed(0.2, 100).direction).toBe('left');
    expect(feed(0.2, CompositionPolicy.directionHoldMs + 10).direction).toBe('right');
  });
});

describe('GuidanceEngine: 준비 완료', () => {
  it('정렬 상태가 holdDurationMs 동안 연속 유지될 때만 ready가 된다', () => {
    const profile = profileOf();
    const h = new Harness(profile);
    const aligned = box(0.5, 0.5, profile.targetSubjectScale.ideal);
    const first = h.step(aligned);
    expect(first.status).toBe('almost');
    expect(first.stableDurationMs).toBe(0);
    let result = first;
    let elapsed = 0;
    while (elapsed + 150 < profile.holdDurationMs) {
      result = h.step(aligned);
      elapsed += 150;
      expect(result.status).toBe('almost');
    }
    result = h.step(aligned, {}, profile.holdDurationMs);
    expect(result.status).toBe('ready');
    expect(result.message).toBe(GuidanceMessages.ready);
    expect(result.stableDurationMs).toBeGreaterThanOrEqual(profile.holdDurationMs);
  });

  it('중간에 틀어지면 유지 시간을 처음부터 다시 센다', () => {
    const profile = profileOf();
    const h = new Harness(profile);
    const ideal = profile.targetSubjectScale.ideal;
    h.step(box(0.5, 0.5, ideal));
    h.step(box(0.5, 0.5, ideal), {}, profile.holdDurationMs - 100);
    expect(h.settle(box(0.85, 0.5, ideal)).status).toBe('adjusting');
    const back = h.settle(box(0.5, 0.5, ideal), 20, {});
    // 다시 맞은 직후에는 almost, 충분히 유지되면 ready
    expect(['almost', 'ready']).toContain(back.status);
    const restarted = new Harness(profile);
    restarted.settle(box(0.85, 0.5, ideal));
    let result = restarted.step(box(0.5, 0.5, ideal));
    let guard = 0;
    while (result.status === 'adjusting' && guard < 30) {
      result = restarted.step(box(0.5, 0.5, ideal));
      guard += 1;
    }
    expect(result.status).toBe('almost');
    expect(result.stableDurationMs).toBe(0);
  });

  it('수평 안내가 켜져 있으면 수평이 맞아야 ready가 된다', () => {
    const profile = profileOf({ levelGuide: true });
    const h = new Harness(profile);
    const aligned = box(0.5, 0.5, profile.targetSubjectScale.ideal);
    const tilted = h.settle(aligned, 12, { rollDeg: 8 });
    expect(tilted.status).toBe('adjusting');
    expect(tilted.direction).toBe('level');
    expect(tilted.level?.isLevel).toBe(false);
    const level = h.settle(aligned, 30, { rollDeg: 0 });
    expect(level.status).toBe('ready');
    expect(level.level?.isLevel).toBe(true);
  });

  it('수평 센서를 쓸 수 없으면(rollDeg=null) 수평을 요구하지 않는다', () => {
    const profile = profileOf({ levelGuide: true });
    const result = new Harness(profile).settle(box(0.5, 0.5, profile.targetSubjectScale.ideal), 12, { rollDeg: null });
    expect(result.level).toBeUndefined();
    expect(result.status).toBe('ready');
  });

  it('프로필이 바뀌면 상태를 초기화한다', () => {
    const profile = profileOf();
    const h = new Harness(profile);
    h.settle(box(0.5, 0.5, profile.targetSubjectScale.ideal));
    h.engine.setProfile(profileOf({ placement: 'left', style: 'negative' }));
    const result = h.step(null);
    expect(result.status).toBe('searching');
    expect(result.reasonCode).toBe('searching');
  });
});

describe('GuidanceEngine: 풍경 모드(센서 수평만 사용)', () => {
  it('피사체 감지 없이 수평만으로 안내한다', () => {
    const profile = profileOf({ mode: 'landscape', levelGuide: true });
    const h = new Harness(profile);
    const tilted = h.settle(null as unknown as NormalizedRect, 1, { rollDeg: 10 });
    expect(tilted.status).toBe('adjusting');
    expect(tilted.direction).toBe('level');
    expect(tilted.targetBounds).toBeUndefined();
    expect(tilted.currentBounds).toBeUndefined();
    let result = h.step(null, { rollDeg: 0 });
    for (let i = 0; i < 40 && result.status !== 'ready'; i += 1) result = h.step(null, { rollDeg: 0 });
    expect(result.status).toBe('ready');
    expect(result.message).toBe(GuidanceMessages.landscapeReady);
  });

  it('수평 센서가 없으면 수동 가이드 안내로 대체한다', () => {
    const profile = profileOf({ mode: 'landscape', levelGuide: true });
    const result = new Harness(profile).step(null, { rollDeg: null });
    expect(result.status).toBe('unavailable');
    expect(result.reasonCode).toBe('manual-guide');
    expect(result.message).toBe(GuidanceMessages.manual);
  });
});

describe('수평 계산', () => {
  it('세로로 똑바로 들면 0°', () => {
    expect(rollFromGravity({ x: 0, y: 1, z: 0 })).toBeCloseTo(0, 5);
    expect(rollFromGravity({ x: 0, y: -1, z: 0 })).toBeCloseTo(0, 5);
  });

  it('기울기 크기를 도 단위로 돌려주고 부호는 축 방향에 따른다', () => {
    const tilt = Math.sin((10 * Math.PI) / 180);
    const upright = Math.cos((10 * Math.PI) / 180);
    expect(rollFromGravity({ x: tilt, y: upright, z: 0 }, 1)).toBeCloseTo(10, 4);
    expect(rollFromGravity({ x: tilt, y: upright, z: 0 }, -1)).toBeCloseTo(-10, 4);
  });

  it('기기를 눕히면(탑뷰) 기울기를 정의하지 않는다', () => {
    expect(rollFromGravity({ x: 0.05, y: 0.1, z: 0.99 })).toBeNull();
    expect(rollFromGravity({ x: 0, y: 0, z: 0 })).toBeNull();
  });

  it('수평 판정에도 히스테리시스가 있다', () => {
    const between = (CompositionPolicy.levelDeadZoneDeg + CompositionPolicy.levelExitZoneDeg) / 2;
    expect(isLevel(between, false)).toBe(false);
    expect(isLevel(between, true)).toBe(true);
    expect(isLevel(CompositionPolicy.levelDeadZoneDeg - 0.1, false)).toBe(true);
    expect(isLevel(CompositionPolicy.levelExitZoneDeg + 0.1, true)).toBe(false);
  });
});

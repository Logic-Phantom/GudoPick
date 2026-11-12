import { CompositionPolicy, type CompositionPolicyValues } from './composition-policy';
import { clamp, isFiniteRect, lerp, rectCenter, rectScale } from './geometry';
import { isLevel } from './level';
import { directionMessage, GuidanceMessages, searchingMessage } from './messages';
import { computeTargetBounds, detectorKindForMode } from './target';
import type {
  CompositionProfile,
  GuidanceDirection,
  GuidanceResult,
  LevelState,
  NormalizedRect,
} from './types';

/** 구도 엔진에 넣는 피사체 관측값. `bounds`는 크롭 프레임 기준 정규 좌표다. */
export interface SubjectObservation {
  bounds: NormalizedRect;
  confidence?: number;
  trackingId?: number | string;
  /** 분석 완료 시각(ms). `GuidanceInput.now`와 같은 시계 */
  timestamp: number;
}

export interface GuidanceInput {
  now: number;
  /** 가장 최근 분석 결과. 대상이 없으면 null */
  subject: SubjectObservation | null;
  /** 기울기(도). 센서를 쓸 수 없거나 기기를 눕힌 경우 null */
  rollDeg: number | null;
  /** 네이티브 detector 사용 가능 여부 */
  detectorAvailable: boolean;
  /** 크롭 프레임의 가로/세로 비 */
  cropAspect: number;
}

/**
 * 구도 안내 엔진.
 *
 * 순수 TypeScript 상태 기계이며 시간은 입력(`now`)으로만 받는다 → 결정적으로 테스트할 수 있다.
 * - 바운딩 박스 EMA 평활화
 * - dead zone + 히스테리시스(위치/크기/수평)
 * - 안내 방향 전환 지연(문구 깜박임 방지)
 * - 탐지 유실 유예 후 상태 복귀, 오래된 결과 무시
 * - 정렬 상태가 holdDurationMs 동안 연속 유지될 때만 ready
 */
export class GuidanceEngine {
  private profile: CompositionProfile;
  private readonly policy: CompositionPolicyValues;

  private smoothed: NormalizedRect | null = null;
  private lastSeenAt: number | null = null;
  private lastTrackingId: number | string | undefined;
  private everSeen = false;

  private positionOk = false;
  private scaleOk = false;
  private levelOk = false;
  private smoothedRoll: number | null = null;

  private direction: GuidanceDirection | undefined;
  private pendingDirection: GuidanceDirection | undefined;
  private pendingSince = 0;

  private alignedSince: number | null = null;

  constructor(profile: CompositionProfile, policy: CompositionPolicyValues = CompositionPolicy) {
    this.profile = profile;
    this.policy = policy;
  }

  setProfile(profile: CompositionProfile): void {
    if (profile === this.profile) return;
    this.profile = profile;
    this.reset();
  }

  reset(): void {
    this.smoothed = null;
    this.lastSeenAt = null;
    this.lastTrackingId = undefined;
    this.everSeen = false;
    this.positionOk = false;
    this.scaleOk = false;
    this.levelOk = false;
    this.smoothedRoll = null;
    this.direction = undefined;
    this.pendingDirection = undefined;
    this.alignedSince = null;
  }

  update(input: GuidanceInput): GuidanceResult {
    const level = this.updateLevel(input.rollDeg);
    const kind = detectorKindForMode(this.profile.mode);

    if (kind === null) return this.updateLevelOnly(input.now, level);

    if (!input.detectorAvailable) {
      this.clearSubject();
      return {
        status: 'unavailable',
        message: GuidanceMessages.detectorUnavailable,
        reasonCode: 'detector-unavailable',
        alignment: 0,
        stableDurationMs: 0,
        level,
      };
    }

    const observation = this.acceptObservation(input);
    if (observation.kind === 'missing') {
      const withinGrace =
        this.smoothed !== null &&
        this.lastSeenAt !== null &&
        input.now - this.lastSeenAt <= this.policy.detectionGraceMs;
      if (!withinGrace) {
        const hadSubject = this.everSeen;
        this.clearSubject();
        if (observation.reason === 'low-confidence') {
          return {
            status: 'unavailable',
            message: GuidanceMessages.lost,
            reasonCode: 'low-confidence',
            alignment: 0,
            stableDurationMs: 0,
            level,
          };
        }
        return {
          status: 'searching',
          message: hadSubject ? GuidanceMessages.lost : searchingMessage(this.profile.mode),
          reasonCode: hadSubject ? 'subject-lost' : 'searching',
          alignment: 0,
          stableDurationMs: 0,
          level,
        };
      }
      // 유예 시간 안: 직전 평활화 결과로 계속 평가한다.
    }

    const current = this.smoothed;
    if (current === null) {
      // 방어 코드: 도달하지 않아야 한다.
      return {
        status: 'searching',
        message: searchingMessage(this.profile.mode),
        reasonCode: 'searching',
        alignment: 0,
        stableDurationMs: 0,
        level,
      };
    }

    const pixelAspect = (current.width / current.height) * input.cropAspect;
    const target = computeTargetBounds(this.profile, input.cropAspect, pixelAspect);
    const center = rectCenter(current);
    const anchor = this.profile.targetAnchor;
    const dx = center.x - anchor.x;
    const dy = center.y - anchor.y;
    const scale = rectScale(current);
    const range = this.profile.targetSubjectScale;

    // 위치: dead zone / exit zone 히스테리시스
    const positionLimit = this.positionOk ? this.policy.positionExitZone : this.policy.positionDeadZone;
    this.positionOk = Math.abs(dx) <= positionLimit && Math.abs(dy) <= positionLimit;

    // 크기: 범위 + 여유 히스테리시스
    const margin = this.scaleOk ? this.policy.scaleExitMargin : 0;
    this.scaleOk = scale >= range.min * (1 - margin) && scale <= range.max * (1 + margin);

    const levelRequired = level !== undefined;
    const levelAligned = !levelRequired || level.isLevel;

    let candidate: GuidanceDirection | undefined;
    if (!this.positionOk) {
      if (Math.abs(dx) >= Math.abs(dy)) candidate = dx > 0 ? 'left' : 'right';
      else candidate = dy > 0 ? 'up' : 'down';
    } else if (!this.scaleOk) {
      candidate = scale < range.min ? 'closer' : 'farther';
    } else if (!levelAligned) {
      candidate = 'level';
    }

    const direction = this.resolveDirection(candidate, input.now);
    const alignment = this.computeAlignment(dx, dy, scale, range.ideal);

    if (candidate === undefined) {
      if (this.alignedSince === null) this.alignedSince = input.now;
      const stableDurationMs = input.now - this.alignedSince;
      const ready = stableDurationMs >= this.profile.holdDurationMs;
      return {
        status: ready ? 'ready' : 'almost',
        message: ready ? GuidanceMessages.ready : GuidanceMessages.almost,
        reasonCode: ready ? 'ready' : 'holding',
        alignment,
        stableDurationMs,
        targetBounds: target,
        currentBounds: current,
        level,
      };
    }

    this.alignedSince = null;
    const shown = direction ?? candidate;
    return {
      status: 'adjusting',
      direction: shown,
      message: directionMessage(shown, this.profile.negativeSpace),
      reasonCode: `adjust-${shown}`,
      alignment,
      stableDurationMs: 0,
      targetBounds: target,
      currentBounds: current,
      level,
    };
  }

  // ---------------------------------------------------------------------------

  private updateLevel(rollDeg: number | null): LevelState | undefined {
    if (!this.profile.levelGuide || rollDeg === null || !Number.isFinite(rollDeg)) {
      this.smoothedRoll = null;
      this.levelOk = false;
      return undefined;
    }
    this.smoothedRoll =
      this.smoothedRoll === null
        ? rollDeg
        : lerp(this.smoothedRoll, rollDeg, this.policy.levelSmoothingAlpha);
    this.levelOk = isLevel(this.smoothedRoll, this.levelOk);
    return { rollDeg: this.smoothedRoll, isLevel: this.levelOk };
  }

  /** 풍경 모드: 피사체 감지 없이 센서 수평만으로 안내한다. */
  private updateLevelOnly(now: number, level: LevelState | undefined): GuidanceResult {
    if (level === undefined) {
      this.alignedSince = null;
      return {
        status: 'unavailable',
        message: GuidanceMessages.manual,
        reasonCode: 'manual-guide',
        alignment: 0,
        stableDurationMs: 0,
      };
    }
    const alignment = 1 - clamp(Math.abs(level.rollDeg) / 15, 0, 1);
    if (!level.isLevel) {
      this.alignedSince = null;
      return {
        status: 'adjusting',
        direction: 'level',
        message: GuidanceMessages.landscapeAdjust,
        reasonCode: 'adjust-level',
        alignment,
        stableDurationMs: 0,
        level,
      };
    }
    if (this.alignedSince === null) this.alignedSince = now;
    const stableDurationMs = now - this.alignedSince;
    const ready = stableDurationMs >= this.profile.holdDurationMs;
    return {
      status: ready ? 'ready' : 'almost',
      message: ready ? GuidanceMessages.landscapeReady : GuidanceMessages.almost,
      reasonCode: ready ? 'ready' : 'holding',
      alignment,
      stableDurationMs,
      level,
    };
  }

  private acceptObservation(
    input: GuidanceInput,
  ): { kind: 'accepted' } | { kind: 'missing'; reason: 'none' | 'stale' | 'low-confidence' } {
    const subject = input.subject;
    if (subject === null || !isFiniteRect(subject.bounds)) return { kind: 'missing', reason: 'none' };
    if (input.now - subject.timestamp > this.policy.staleResultMs) {
      return { kind: 'missing', reason: 'stale' };
    }
    if (subject.confidence !== undefined && subject.confidence < this.policy.minConfidence) {
      return { kind: 'missing', reason: 'low-confidence' };
    }

    const trackingChanged =
      subject.trackingId !== undefined &&
      this.lastTrackingId !== undefined &&
      subject.trackingId !== this.lastTrackingId;

    if (this.smoothed === null || trackingChanged) {
      this.smoothed = { ...subject.bounds };
      if (trackingChanged) {
        this.positionOk = false;
        this.scaleOk = false;
        this.alignedSince = null;
      }
    } else if (this.lastSeenAt !== subject.timestamp) {
      // 같은 관측값이 다시 들어온 경우(새 분석 결과 없음)에는 평활화를 반복 적용하지 않는다.
      const alpha = this.policy.smoothingAlpha;
      this.smoothed = {
        x: lerp(this.smoothed.x, subject.bounds.x, alpha),
        y: lerp(this.smoothed.y, subject.bounds.y, alpha),
        width: lerp(this.smoothed.width, subject.bounds.width, alpha),
        height: lerp(this.smoothed.height, subject.bounds.height, alpha),
      };
    }
    this.lastSeenAt = subject.timestamp;
    this.lastTrackingId = subject.trackingId;
    this.everSeen = true;
    return { kind: 'accepted' };
  }

  private clearSubject(): void {
    this.smoothed = null;
    this.lastSeenAt = null;
    this.lastTrackingId = undefined;
    this.positionOk = false;
    this.scaleOk = false;
    this.direction = undefined;
    this.pendingDirection = undefined;
    this.alignedSince = null;
  }

  /** 안내 방향 전환 지연: 새 방향이 directionHoldMs 동안 유지되어야 문구를 바꾼다. */
  private resolveDirection(
    candidate: GuidanceDirection | undefined,
    now: number,
  ): GuidanceDirection | undefined {
    if (candidate === undefined) {
      this.direction = undefined;
      this.pendingDirection = undefined;
      return undefined;
    }
    if (this.direction === undefined || candidate === this.direction) {
      this.direction = candidate;
      this.pendingDirection = undefined;
      return this.direction;
    }
    if (this.pendingDirection !== candidate) {
      this.pendingDirection = candidate;
      this.pendingSince = now;
      return this.direction;
    }
    if (now - this.pendingSince >= this.policy.directionHoldMs) {
      this.direction = candidate;
      this.pendingDirection = undefined;
    }
    return this.direction;
  }

  private computeAlignment(dx: number, dy: number, scale: number, ideal: number): number {
    const positionError = clamp(Math.max(Math.abs(dx), Math.abs(dy)) / 0.5, 0, 1);
    const scaleError = ideal > 0 ? clamp(Math.abs(scale - ideal) / ideal, 0, 1) : 0;
    return clamp(1 - (positionError * 0.6 + scaleError * 0.4), 0, 1);
  }
}

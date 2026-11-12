import type { GuidanceDirection, NegativeSpace, ShootingMode } from './types';

/**
 * 안내 문구. 카메라를 어느 쪽으로 움직이라는 표현 대신
 * "피사체를 화면의 가이드 쪽으로" 맞추는 표현을 기본으로 한다.
 */
export const GuidanceMessages = {
  searchingFace: '얼굴을 찾고 있어요.',
  searchingObject: '피사체를 찾고 있어요.',
  lost: '피사체를 화면에 맞춰 주세요.',
  ready: '좋아요. 이 구도로 촬영해 보세요.',
  almost: '좋아요. 그대로 잠시 유지해 주세요.',
  closer: '조금 더 가까이 가보세요.',
  farther: '조금 더 멀리서 담아보세요.',
  level: '수평을 맞춰주세요',
  levelOk: '수평이 맞았어요',
  manual: '가이드에 맞춰 직접 구도를 잡아보세요.',
  landscapeReady: '수평이 맞았어요. 이 구도로 촬영해 보세요.',
  landscapeAdjust: '휴대폰을 살짝 기울여 수평을 맞춰보세요.',
  detectorUnavailable: '피사체 분석을 사용할 수 없어요. 수동 가이드를 이용해 주세요.',
} as const;

const DIRECTION_WORD: Record<'left' | 'right' | 'up' | 'down', string> = {
  left: '왼쪽',
  right: '오른쪽',
  up: '위쪽',
  down: '아래쪽',
};

const SPACE_WORD: Record<Exclude<NegativeSpace, 'none'>, string> = {
  left: '왼쪽',
  right: '오른쪽',
  top: '위쪽',
  bottom: '아래쪽',
};

/** 피사체가 이동해야 할 방향 → 문구 */
export function moveMessage(
  direction: 'left' | 'right' | 'up' | 'down',
  negativeSpace: NegativeSpace,
): string {
  // 여백을 남기기 위한 이동이라면 여백 중심 문구를 쓴다.
  // 예) 오른쪽 여백 프로필에서 피사체가 왼쪽으로 가야 할 때 → "오른쪽에 여백을 두세요"
  const opposite: Record<typeof direction, Exclude<NegativeSpace, 'none'>> = {
    left: 'right',
    right: 'left',
    up: 'bottom',
    down: 'top',
  };
  if (negativeSpace !== 'none' && opposite[direction] === negativeSpace) {
    return `${SPACE_WORD[negativeSpace]}에 여백을 두세요`;
  }
  return `피사체를 ${DIRECTION_WORD[direction]} 가이드에 맞춰 보세요.`;
}

export function searchingMessage(mode: ShootingMode): string {
  return mode === 'portrait' || mode === 'ootd'
    ? GuidanceMessages.searchingFace
    : GuidanceMessages.searchingObject;
}

export function directionMessage(direction: GuidanceDirection, negativeSpace: NegativeSpace): string {
  switch (direction) {
    case 'closer':
      return GuidanceMessages.closer;
    case 'farther':
      return GuidanceMessages.farther;
    case 'level':
      return GuidanceMessages.landscapeAdjust;
    default:
      return moveMessage(direction, negativeSpace);
  }
}

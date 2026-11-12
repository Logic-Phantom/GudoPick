/**
 * 구도 안내 정책 상수. 튜닝은 이 파일 한 곳에서만 한다.
 * 값은 초기 내부 기준이며 실기기 측정 후 조정 대상이다 (docs/COMPOSITION_ALGORITHM.md).
 */
export const CompositionPolicy = {
  /** 위치 오차 허용 범위(크롭 프레임 대비 비율). 이 안으로 들어오면 "맞음" */
  positionDeadZone: 0.06,
  /** 한번 맞은 뒤에는 이 범위를 벗어나야 "틀어짐"으로 본다 (히스테리시스) */
  positionExitZone: 0.09,
  /** 크기 범위 [min, max] 를 벗어난 뒤 다시 틀어졌다고 볼 여유 비율 */
  scaleExitMargin: 0.1,
  /** 수평 허용 각도(도) */
  levelDeadZoneDeg: 2,
  levelExitZoneDeg: 3.5,
  /** 기기가 이보다 눕혀져 있으면(중력의 화면 평면 성분 비율) 수평 안내를 하지 않는다 */
  levelMinPlanarGravity: 0.35,

  /** detector가 신뢰도를 줄 때 이 값 미만이면 사용하지 않는다 */
  minConfidence: 0.5,
  /** 탐지가 사라진 뒤 이전 결과를 유지하는 유예 시간(ms) */
  detectionGraceMs: 600,
  /** 이보다 오래된 분석 결과는 무시한다(ms) */
  staleResultMs: 1000,

  /** 바운딩 박스 EMA 계수 (1에 가까울수록 최신 값 반영이 빠름) */
  smoothingAlpha: 0.45,
  /** 수평 각도 EMA 계수 */
  levelSmoothingAlpha: 0.3,

  /** 안내 방향이 바뀌려면 새 방향이 이 시간만큼 연속 유지되어야 한다(ms) */
  directionHoldMs: 250,
  /** 준비 완료까지 정렬 상태를 유지해야 하는 기본 시간(ms) */
  defaultHoldDurationMs: 700,

  /** 분석 빈도 제한: 최소 간격(ms) → 약 6~7회/초 */
  analysisMinIntervalMs: 150,
} as const;

export type CompositionPolicyValues = typeof CompositionPolicy;

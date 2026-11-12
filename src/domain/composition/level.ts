import { CompositionPolicy } from './composition-policy';

export interface GravityVector {
  x: number;
  y: number;
  z: number;
}

/**
 * 중력 벡터로부터 세로(portrait)로 든 기기의 좌우 기울기(roll, 도)를 구한다.
 *
 * - 반환값 0 = 수평. 양수 = 화면이 시계 방향으로 기울어짐.
 * - 기기를 눕혀(탑뷰 촬영 등) 화면 평면의 중력 성분이 작으면 기울기를 정의할 수 없으므로
 *   `null`을 반환한다 → 수평 안내를 표시하지 않는다.
 *
 * `xSign`은 플랫폼별 축 부호 차이를 흡수하기 위한 값이다(크기에는 영향 없음).
 */
export function rollFromGravity(gravity: GravityVector, xSign: 1 | -1 = 1): number | null {
  const { x, y, z } = gravity;
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  if (!(magnitude > 0)) return null;
  const planar = Math.sqrt(x * x + y * y) / magnitude;
  if (planar < CompositionPolicy.levelMinPlanarGravity) return null;
  const roll = Math.atan2(xSign * x, Math.abs(y)) * (180 / Math.PI);
  return roll;
}

/** 히스테리시스를 적용한 수평 판정 */
export function isLevel(rollDeg: number, wasLevel: boolean): boolean {
  const limit = wasLevel ? CompositionPolicy.levelExitZoneDeg : CompositionPolicy.levelDeadZoneDeg;
  return Math.abs(rollDeg) <= limit;
}

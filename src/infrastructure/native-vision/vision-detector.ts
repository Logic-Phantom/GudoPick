import { createVisionDetector, type VisionDetector } from 'gudopick-vision';

let instance: VisionDetector | null | undefined;

/**
 * 네이티브 ML Kit 감지기(Nitro HybridObject)를 한 번만 만들어 돌려준다.
 * 네이티브 모듈이 없는 환경(Expo Go 등)에서는 null → 호출자는 수동 가이드로 대체한다.
 */
export function getVisionDetector(): VisionDetector | null {
  if (instance === undefined) {
    try {
      instance = createVisionDetector();
    } catch {
      instance = null;
    }
  }
  return instance;
}

/** 화면 이탈/백그라운드 시 detector 리소스를 닫는다. 다음 분석 때 다시 만들어진다. */
export function closeVisionDetector(): void {
  try {
    instance?.close();
  } catch {
    // 닫기 실패는 무시한다.
  }
}

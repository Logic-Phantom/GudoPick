import type { PhotoMetrics } from '@/domain/capture/photo-quality';

import { getVisionDetector } from './vision-detector';

/**
 * 촬영된 사진 파일의 밝기·선명도를 네이티브에서 계산한다.
 * 계산할 수 없으면 null → 화면에는 '확인 불가'로 표시한다(값을 지어내지 않는다).
 */
export async function analyzePhotoFile(uri: string): Promise<PhotoMetrics | null> {
  const detector = getVisionDetector();
  if (!detector) return null;
  try {
    const path = decodeURIComponent(uri.replace(/^file:\/\//, ''));
    const result = await detector.analyzePhoto(path);
    if (!result) return null;
    const { meanLuminance, darkRatio, brightRatio, sharpness } = result;
    if (![meanLuminance, darkRatio, brightRatio, sharpness].every(Number.isFinite)) return null;
    return { meanLuminance, darkRatio, brightRatio, sharpness };
  } catch {
    return null;
  }
}

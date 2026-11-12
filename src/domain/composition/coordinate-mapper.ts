import { aspectRatioValue, isFiniteRect } from './geometry';
import type { AspectRatioPreset, NormalizedRect, Size, ViewRect } from './types';

export type FrameOrientation = 'up' | 'right' | 'down' | 'left';
export type ResizeMode = 'cover' | 'contain';

/**
 * 회전 전(버퍼) 정규 좌표를 "똑바로 세운" 정규 좌표로 변환한다.
 *
 * `orientation`은 픽셀 데이터가 원하는 방향 대비 얼마나 돌아가 있는지를 뜻한다.
 * - 'right': 버퍼를 시계 방향 90° 돌려야 똑바로 선다.
 * - 'left' : 버퍼를 반시계 방향 90° 돌려야 똑바로 선다.
 * - 'down' : 180°.
 *
 * Android(ML Kit)는 회전을 적용한 좌표를 직접 돌려주므로 이 함수가 필요 없고,
 * iOS 네이티브 구현과 동일한 수식을 테스트로 고정하기 위해 TypeScript에도 둔다.
 */
export function rotateToUpright(rect: NormalizedRect, orientation: FrameOrientation): NormalizedRect {
  switch (orientation) {
    case 'up':
      return { ...rect };
    case 'down':
      return {
        x: 1 - rect.x - rect.width,
        y: 1 - rect.y - rect.height,
        width: rect.width,
        height: rect.height,
      };
    case 'right':
      return {
        x: 1 - rect.y - rect.height,
        y: rect.x,
        width: rect.height,
        height: rect.width,
      };
    case 'left':
      return {
        x: rect.y,
        y: 1 - rect.x - rect.width,
        width: rect.height,
        height: rect.width,
      };
  }
}

/** 좌우 반전 (전면 카메라 프리뷰) */
export function mirrorHorizontally(rect: NormalizedRect): NormalizedRect {
  return { ...rect, x: 1 - rect.x - rect.width };
}

export interface FrameToViewOptions {
  /** 똑바로 세운 프레임의 픽셀 크기 */
  frame: Size;
  /** 프리뷰 뷰의 크기(px/dp) */
  view: Size;
  resizeMode: ResizeMode;
  /** 프리뷰가 좌우 반전되어 보이는지 */
  mirrored: boolean;
}

/**
 * 똑바로 세운 프레임 기준 정규 좌표 → 프리뷰 뷰 좌표.
 * 프레임과 프리뷰가 같은 화각을 공유한다고 가정하고, aspect-fill/fit 스케일과
 * 중앙 정렬 오프셋, 미러링을 적용한다.
 * 크기를 알 수 없으면 `null`을 반환한다 → 호출자는 박스를 그리지 않는다.
 */
export function mapFrameRectToView(rect: NormalizedRect, options: FrameToViewOptions): ViewRect | null {
  const { frame, view, resizeMode, mirrored } = options;
  if (!(frame.width > 0 && frame.height > 0 && view.width > 0 && view.height > 0)) return null;
  if (!isFiniteRect(rect)) return null;

  const source = mirrored ? mirrorHorizontally(rect) : rect;
  const scaleX = view.width / frame.width;
  const scaleY = view.height / frame.height;
  const scale = resizeMode === 'cover' ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);

  const displayedWidth = frame.width * scale;
  const displayedHeight = frame.height * scale;
  const offsetX = (view.width - displayedWidth) / 2;
  const offsetY = (view.height - displayedHeight) / 2;

  return {
    x: offsetX + source.x * displayedWidth,
    y: offsetY + source.y * displayedHeight,
    width: source.width * displayedWidth,
    height: source.height * displayedHeight,
  };
}

/**
 * 프리뷰 뷰 안에서 선택한 비율의 크롭 프레임이 차지하는 영역(가운데 정렬, 최대 크기).
 * `inset`은 크롭 프레임과 프리뷰 가장자리 사이의 여백(px)이다.
 */
export function computeCropRect(view: Size, aspectRatio: AspectRatioPreset, inset = 0): ViewRect {
  const availableWidth = Math.max(view.width - inset * 2, 0);
  const availableHeight = Math.max(view.height - inset * 2, 0);
  const ratio = aspectRatioValue(aspectRatio);

  let width = availableWidth;
  let height = ratio > 0 ? width / ratio : 0;
  if (height > availableHeight) {
    height = availableHeight;
    width = height * ratio;
  }
  return {
    x: (view.width - width) / 2,
    y: (view.height - height) / 2,
    width,
    height,
  };
}

/** 뷰 좌표 사각형 → 크롭 프레임 기준 정규 좌표 (프레임 밖이면 0..1을 벗어날 수 있다) */
export function viewRectToCropNormalized(rect: ViewRect, crop: ViewRect): NormalizedRect | null {
  if (!(crop.width > 0 && crop.height > 0)) return null;
  return {
    x: (rect.x - crop.x) / crop.width,
    y: (rect.y - crop.y) / crop.height,
    width: rect.width / crop.width,
    height: rect.height / crop.height,
  };
}

/** 크롭 프레임 기준 정규 좌표 → 뷰 좌표 */
export function cropNormalizedToViewRect(rect: NormalizedRect, crop: ViewRect): ViewRect {
  return {
    x: crop.x + rect.x * crop.width,
    y: crop.y + rect.y * crop.height,
    width: rect.width * crop.width,
    height: rect.height * crop.height,
  };
}

/**
 * detector 결과(정방향 프레임 좌표) → 크롭 프레임 기준 정규 좌표.
 * 구도 엔진은 이 좌표만 다룬다.
 */
export function mapDetectionToCrop(
  rect: NormalizedRect,
  options: FrameToViewOptions & { crop: ViewRect },
): NormalizedRect | null {
  const viewRect = mapFrameRectToView(rect, options);
  if (!viewRect) return null;
  return viewRectToCropNormalized(viewRect, options.crop);
}

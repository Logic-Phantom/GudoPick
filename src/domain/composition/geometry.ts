import type { AspectRatioPreset, NormalizedRect, Point, ViewRect } from './types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function rectCenter(rect: NormalizedRect | ViewRect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** 피사체 크기 지표: sqrt(가로비율 × 세로비율). 가로/세로 비율이 달라도 안정적이다. */
export function rectScale(rect: NormalizedRect): number {
  return Math.sqrt(Math.max(rect.width, 0) * Math.max(rect.height, 0));
}

/** 가로/세로 비율 프리셋을 width/height 숫자로 바꾼다. */
export function aspectRatioValue(preset: AspectRatioPreset): number {
  switch (preset) {
    case '1:1':
      return 1;
    case '4:5':
      return 4 / 5;
    case '3:4':
      return 3 / 4;
    case '9:16':
      return 9 / 16;
  }
}

export function isFiniteRect(rect: NormalizedRect | ViewRect): boolean {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

export function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

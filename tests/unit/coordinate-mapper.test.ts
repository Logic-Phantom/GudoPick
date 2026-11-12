import {
  computeCropRect,
  cropNormalizedToViewRect,
  mapDetectionToCrop,
  mapFrameRectToView,
  mirrorHorizontally,
  rotateToUpright,
  viewRectToCropNormalized,
} from '@/domain/composition/coordinate-mapper';
import { aspectRatioValue, rectCenter } from '@/domain/composition/geometry';
import type { NormalizedRect } from '@/domain/composition/types';
import { toDetectionResult } from '@/infrastructure/native-vision/detection-mapping';

const close = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 5);

describe('회전 좌표 처리 (버퍼 → 정방향)', () => {
  // 가로로 누운 센서 버퍼의 왼쪽 위 영역
  const buffer: NormalizedRect = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };

  it("'up'은 그대로다", () => {
    expect(rotateToUpright(buffer, 'up')).toEqual(buffer);
  });

  it("'right'(시계 방향 90° 회전 필요): 버퍼의 위쪽 변이 정방향의 오른쪽 변이 된다", () => {
    const rect = rotateToUpright(buffer, 'right');
    close(rect.x, 1 - 0.2 - 0.4);
    close(rect.y, 0.1);
    close(rect.width, 0.4);
    close(rect.height, 0.3);
  });

  it("'left'(반시계 90°): 버퍼의 위쪽 변이 정방향의 왼쪽 변이 된다", () => {
    const rect = rotateToUpright(buffer, 'left');
    close(rect.x, 0.2);
    close(rect.y, 1 - 0.1 - 0.3);
    close(rect.width, 0.4);
    close(rect.height, 0.3);
  });

  it("'down'은 180° 회전이다", () => {
    const rect = rotateToUpright(buffer, 'down');
    close(rect.x, 0.6);
    close(rect.y, 0.4);
    close(rect.width, 0.3);
    close(rect.height, 0.4);
  });

  it('right 다음 left는 원래대로 돌아온다', () => {
    const back = rotateToUpright(rotateToUpright(buffer, 'right'), 'left');
    close(back.x, buffer.x);
    close(back.y, buffer.y);
    close(back.width, buffer.width);
    close(back.height, buffer.height);
  });

  it('down을 두 번 적용하면 원래대로 돌아온다', () => {
    const back = rotateToUpright(rotateToUpright(buffer, 'down'), 'down');
    close(back.x, buffer.x);
    close(back.y, buffer.y);
  });

  it('회전해도 넓이는 보존된다', () => {
    for (const orientation of ['up', 'right', 'down', 'left'] as const) {
      const rect = rotateToUpright(buffer, orientation);
      close(rect.width * rect.height, buffer.width * buffer.height);
    }
  });
});

describe('미러링 (전면 카메라)', () => {
  it('왼쪽에 있던 피사체는 반전 후 오른쪽에 온다', () => {
    const rect = mirrorHorizontally({ x: 0.1, y: 0.3, width: 0.2, height: 0.2 });
    close(rect.x, 0.7);
    close(rect.y, 0.3);
  });

  it('후면(반전 없음)과 전면(반전)에서 같은 피사체의 화면 위치가 좌우 대칭이다', () => {
    const subject: NormalizedRect = { x: 0.1, y: 0.4, width: 0.2, height: 0.2 };
    const options = { frame: { width: 480, height: 640 }, view: { width: 360, height: 480 }, resizeMode: 'cover' as const };
    const back = mapFrameRectToView(subject, { ...options, mirrored: false })!;
    const front = mapFrameRectToView(subject, { ...options, mirrored: true })!;
    close(rectCenter(back).x + rectCenter(front).x, 360);
    close(rectCenter(back).y, rectCenter(front).y);
    close(back.width, front.width);
  });
});

describe('프레임 → 프리뷰 뷰 변환', () => {
  it('비율이 같으면 단순 스케일이다', () => {
    const rect = mapFrameRectToView(
      { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      { frame: { width: 480, height: 640 }, view: { width: 360, height: 480 }, resizeMode: 'cover', mirrored: false },
    )!;
    close(rect.x, 90);
    close(rect.y, 120);
    close(rect.width, 180);
    close(rect.height, 240);
  });

  it('aspect-fill(cover): 넘치는 쪽이 잘리고 가운데가 맞는다', () => {
    // 3:4 프레임을 정사각 뷰에 cover → 위아래가 잘린다.
    const options = { frame: { width: 300, height: 400 }, view: { width: 300, height: 300 }, resizeMode: 'cover' as const, mirrored: false };
    const center = mapFrameRectToView({ x: 0.4, y: 0.4, width: 0.2, height: 0.2 }, options)!;
    close(rectCenter(center).x, 150);
    close(rectCenter(center).y, 150);
    // 프레임 맨 위는 뷰 밖(음수)으로 나간다.
    const top = mapFrameRectToView({ x: 0, y: 0, width: 1, height: 0.1 }, options)!;
    close(top.y, -50);
    close(top.width, 300);
  });

  it('aspect-fit(contain): 전체가 보이고 남는 쪽에 여백이 생긴다', () => {
    const options = { frame: { width: 300, height: 400 }, view: { width: 300, height: 300 }, resizeMode: 'contain' as const, mirrored: false };
    const full = mapFrameRectToView({ x: 0, y: 0, width: 1, height: 1 }, options)!;
    close(full.width, 225);
    close(full.height, 300);
    close(full.x, 37.5);
    close(full.y, 0);
  });

  it('크기를 모르면 null을 돌려준다 → 박스를 그리지 않는다', () => {
    const rect = { x: 0.1, y: 0.1, width: 0.2, height: 0.2 };
    expect(
      mapFrameRectToView(rect, { frame: { width: 0, height: 0 }, view: { width: 300, height: 400 }, resizeMode: 'cover', mirrored: false }),
    ).toBeNull();
    expect(
      mapFrameRectToView(rect, { frame: { width: 480, height: 640 }, view: { width: 0, height: 0 }, resizeMode: 'cover', mirrored: false }),
    ).toBeNull();
    expect(
      mapFrameRectToView(
        { x: Number.NaN, y: 0, width: 0.2, height: 0.2 },
        { frame: { width: 480, height: 640 }, view: { width: 300, height: 400 }, resizeMode: 'cover', mirrored: false },
      ),
    ).toBeNull();
  });
});

describe('크롭 프레임', () => {
  const view = { width: 360, height: 480 };

  it('모든 비율이 뷰 안에 가운데 정렬로 들어간다', () => {
    for (const ratio of ['1:1', '4:5', '3:4', '9:16'] as const) {
      const crop = computeCropRect(view, ratio);
      close(crop.width / crop.height, aspectRatioValue(ratio));
      expect(crop.x).toBeGreaterThanOrEqual(0);
      expect(crop.y).toBeGreaterThanOrEqual(0);
      expect(crop.x + crop.width).toBeLessThanOrEqual(view.width + 1e-6);
      expect(crop.y + crop.height).toBeLessThanOrEqual(view.height + 1e-6);
      close(crop.x + crop.width / 2, view.width / 2);
      close(crop.y + crop.height / 2, view.height / 2);
    }
  });

  it('3:4 뷰에서 3:4는 전체, 1:1은 너비 기준, 9:16은 높이 기준이다', () => {
    expect(computeCropRect(view, '3:4')).toEqual({ x: 0, y: 0, width: 360, height: 480 });
    const square = computeCropRect(view, '1:1');
    close(square.width, 360);
    close(square.y, 60);
    const tall = computeCropRect(view, '9:16');
    close(tall.height, 480);
    close(tall.width, 270);
    close(tall.x, 45);
  });

  it('여백(inset)을 주면 그만큼 작아진다', () => {
    const crop = computeCropRect(view, '3:4', 12);
    close(crop.width, 336);
    close(crop.x, 12);
  });

  it('뷰 좌표 ↔ 크롭 정규 좌표는 서로 역변환이다', () => {
    const crop = computeCropRect(view, '1:1');
    const normalized = { x: 0.2, y: 0.3, width: 0.4, height: 0.25 };
    const back = viewRectToCropNormalized(cropNormalizedToViewRect(normalized, crop), crop)!;
    close(back.x, normalized.x);
    close(back.y, normalized.y);
    close(back.width, normalized.width);
    close(back.height, normalized.height);
  });

  it('크롭 밖의 피사체는 0..1 범위를 벗어난 좌표로 표현된다', () => {
    const crop = computeCropRect(view, '1:1'); // y: 60..420
    const normalized = viewRectToCropNormalized({ x: 0, y: 0, width: 90, height: 30 }, crop)!;
    expect(normalized.y).toBeLessThan(0);
  });
});

describe('감지 결과 → 크롭 좌표 (전체 경로)', () => {
  const view = { width: 360, height: 480 };

  it('프레임 중앙의 피사체는 어떤 비율에서도 크롭 중앙에 온다', () => {
    for (const ratio of ['1:1', '4:5', '3:4', '9:16'] as const) {
      const crop = computeCropRect(view, ratio);
      const mapped = mapDetectionToCrop(
        { x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
        { frame: { width: 480, height: 640 }, view, resizeMode: 'cover', mirrored: false, crop },
      )!;
      close(rectCenter(mapped).x, 0.5);
      close(rectCenter(mapped).y, 0.5);
    }
  });

  it('가로 방향 프레임도 같은 규칙으로 변환한다', () => {
    const landscapeView = { width: 480, height: 360 };
    const mapped = mapFrameRectToView(
      { x: 0.5, y: 0, width: 0.5, height: 1 },
      { frame: { width: 640, height: 480 }, view: landscapeView, resizeMode: 'cover', mirrored: false },
    )!;
    close(mapped.x, 240);
    close(mapped.width, 240);
    close(mapped.height, 360);
  });
});

describe('네이티브 감지 결과 변환', () => {
  const native = {
    kind: 'face' as const,
    x: 0.1,
    y: 0.2,
    width: 0.3,
    height: 0.3,
    frameWidth: 480,
    frameHeight: 640,
    isMirrored: false,
    timestampMs: 123,
    analysisDurationMs: 20,
  };

  it('JS 수신 시각과 프리뷰 미러 여부를 기록한다', () => {
    const result = toDetectionResult(native, { receivedAt: 5000, previewMirrored: true })!;
    expect(result.timestamp).toBe(5000);
    expect(result.mirrored).toBe(true);
    expect(result.orientation).toBe('portrait');
    expect(result.bounds).toEqual({ x: 0.1, y: 0.2, width: 0.3, height: 0.3 });
    expect(result.confidence).toBeUndefined();
  });

  it('가로 프레임은 landscape로 표시한다', () => {
    const result = toDetectionResult({ ...native, frameWidth: 640, frameHeight: 480 }, { receivedAt: 1, previewMirrored: false })!;
    expect(result.orientation).toBe('landscape');
  });

  it('잘못된 값은 버린다', () => {
    expect(toDetectionResult({ ...native, width: 0 }, { receivedAt: 1, previewMirrored: false })).toBeNull();
    expect(toDetectionResult({ ...native, x: Number.NaN }, { receivedAt: 1, previewMirrored: false })).toBeNull();
    expect(toDetectionResult({ ...native, frameWidth: 0 }, { receivedAt: 1, previewMirrored: false })).toBeNull();
  });
});

import { CaptureSession, type CaptureFilePort, type PhotoLibraryPort } from '@/domain/capture/capture-session';
import {
  assessExposure,
  assessLevel,
  assessSharpness,
  buildQualityTiles,
  PhotoQualityPolicy,
  type PhotoMetrics,
} from '@/domain/capture/photo-quality';
import { describeCameraPermission } from '@/features/camera/permission-state';

function setup(options: {
  permission?: ('granted' | 'denied' | 'blocked')[];
  saveFails?: number;
  deleteThrows?: boolean;
} = {}) {
  const deleted: string[] = [];
  const saved: string[] = [];
  const permissions = [...(options.permission ?? ['granted'])];
  let failures = options.saveFails ?? 0;
  let permissionRequests = 0;

  const files: CaptureFilePort = {
    async deleteTemp(uri) {
      if (options.deleteThrows) throw new Error('disk');
      deleted.push(uri);
    },
  };
  const library: PhotoLibraryPort = {
    async ensureAddPermission() {
      permissionRequests += 1;
      return permissions.length > 1 ? permissions.shift()! : permissions[0];
    },
    async saveToLibrary(uri) {
      if (failures > 0) {
        failures -= 1;
        throw new Error('save failed');
      }
      saved.push(uri);
    },
  };
  return {
    session: new CaptureSession(files, library),
    deleted,
    saved,
    requests: () => permissionRequests,
  };
}

const photo = { uri: 'file:///cache/gudopick-capture-1.jpg', width: 3000, height: 4000 };

describe('촬영 → 검토 → 저장/취소', () => {
  it('촬영만으로는 저장되지 않는다(자동 저장 없음)', async () => {
    const { session, saved, deleted } = setup();
    await session.begin(photo);
    expect(session.getState().phase).toBe('reviewing');
    expect(saved).toEqual([]);
    expect(deleted).toEqual([]);
  });

  it('저장을 누르면 사진 앱에 추가하고 임시 파일을 지운다', async () => {
    const { session, saved, deleted } = setup();
    await session.begin(photo);
    await expect(session.save()).resolves.toEqual({ ok: true });
    expect(saved).toEqual([photo.uri]);
    expect(deleted).toEqual([photo.uri]);
    expect(session.getState().phase).toBe('saved');
  });

  it('다시 찍기/취소는 저장하지 않고 임시 파일을 지운다', async () => {
    const { session, saved, deleted } = setup();
    await session.begin(photo);
    await session.discard();
    expect(saved).toEqual([]);
    expect(deleted).toEqual([photo.uri]);
    expect(session.getState().phase).toBe('idle');
  });

  it('저장 실패 시 임시 파일을 남겨 재시도할 수 있다', async () => {
    const { session, saved, deleted } = setup({ saveFails: 1 });
    await session.begin(photo);
    await expect(session.save()).resolves.toEqual({ ok: false, reason: 'save-failed' });
    expect(deleted).toEqual([]);
    const state = session.getState();
    expect(state.phase).toBe('reviewing');
    expect(state.phase === 'reviewing' && state.lastError).toBe('save-failed');
    // 재시도
    await expect(session.save()).resolves.toEqual({ ok: true });
    expect(saved).toEqual([photo.uri]);
    expect(deleted).toEqual([photo.uri]);
  });

  it('사진 추가 권한을 거부하면 저장하지 않고, 다시 누르면 재요청한다', async () => {
    const { session, saved, deleted, requests } = setup({ permission: ['denied', 'granted'] });
    await session.begin(photo);
    await expect(session.save()).resolves.toEqual({ ok: false, reason: 'permission-denied' });
    expect(saved).toEqual([]);
    expect(deleted).toEqual([]);
    await expect(session.save()).resolves.toEqual({ ok: true });
    expect(requests()).toBe(2);
    expect(saved).toEqual([photo.uri]);
  });

  it('권한이 영구 거부되면 설정 이동이 필요한 상태를 알려준다', async () => {
    const { session, saved } = setup({ permission: ['blocked'] });
    await session.begin(photo);
    await expect(session.save()).resolves.toEqual({ ok: false, reason: 'permission-blocked' });
    expect(saved).toEqual([]);
    expect(session.getState().phase).toBe('reviewing');
  });

  it('새 촬영을 시작하면 이전 임시 파일을 지운다', async () => {
    const { session, deleted } = setup();
    await session.begin(photo);
    const next = { ...photo, uri: 'file:///cache/gudopick-capture-2.jpg' };
    await session.begin(next);
    expect(deleted).toEqual([photo.uri]);
    const state = session.getState();
    expect(state.phase === 'reviewing' && state.photo.uri).toBe(next.uri);
  });

  it('임시 파일 삭제가 실패해도 사용자 흐름은 계속된다', async () => {
    const { session, saved } = setup({ deleteThrows: true });
    await session.begin(photo);
    await expect(session.save()).resolves.toEqual({ ok: true });
    expect(saved).toEqual([photo.uri]);
    await expect(session.discard()).resolves.toBeUndefined();
  });

  it('검토 중이 아닐 때 저장을 호출하면 아무것도 저장하지 않는다', async () => {
    const { session, saved } = setup();
    await expect(session.save()).resolves.toEqual({ ok: false, reason: 'save-failed' });
    expect(saved).toEqual([]);
  });
});

describe('촬영 확인(사진 지표 판정)', () => {
  const good: PhotoMetrics = { meanLuminance: 0.5, darkRatio: 0.1, brightRatio: 0.05, sharpness: 300 };

  it('노출 판정', () => {
    expect(assessExposure(good)).toBe('good');
    expect(assessExposure({ ...good, meanLuminance: PhotoQualityPolicy.darkMean - 0.05 })).toBe('dark');
    expect(assessExposure({ ...good, darkRatio: 0.9 })).toBe('dark');
    expect(assessExposure({ ...good, meanLuminance: 0.9 })).toBe('bright');
    expect(assessExposure({ ...good, brightRatio: 0.5 })).toBe('bright');
  });

  it('선명도 판정', () => {
    expect(assessSharpness(good)).toBe('sharp');
    expect(assessSharpness({ ...good, sharpness: PhotoQualityPolicy.softSharpness + 1 })).toBe('fair');
    expect(assessSharpness({ ...good, sharpness: 5 })).toBe('soft');
  });

  it('수평 판정', () => {
    expect(assessLevel(0.5)).toBe('level');
    expect(assessLevel(-9)).toBe('tilted');
    expect(assessLevel(null)).toBe('unknown');
  });

  it('측정하지 못한 값은 지어내지 않고 확인 불가로 표시한다', () => {
    const tiles = buildQualityTiles(null, null);
    expect(tiles.map((tile) => tile.key)).toEqual(['level', 'exposure', 'sharpness']);
    expect(tiles.every((tile) => tile.unknown && tile.value === '확인 불가')).toBe(true);
  });

  it('측정값이 있으면 항목별 결과를 만든다', () => {
    const tiles = buildQualityTiles({ ...good, sharpness: 10 }, 7.4);
    expect(tiles[0]).toMatchObject({ title: '수평', value: '7° 기울어짐', ok: false, unknown: false });
    expect(tiles[1]).toMatchObject({ title: '노출', value: '적절', ok: true });
    expect(tiles[2]).toMatchObject({ title: '선명도', value: '흐림', ok: false });
  });
});

describe('카메라 권한 안내', () => {
  it('허용 + 카메라 있음 → 카메라 표시', () => {
    expect(describeCameraPermission('authorized', true).canShowCamera).toBe(true);
  });

  it('아직 묻지 않음 → 이유 설명 후 요청', () => {
    const view = describeCameraPermission('not-determined', true);
    expect(view.canShowCamera).toBe(false);
    expect(view.action).toBe('request');
  });

  it('거부/제한 → 다시 요청할 수 없으므로 설정으로 안내', () => {
    expect(describeCameraPermission('denied', true).action).toBe('open-settings');
    expect(describeCameraPermission('restricted', true).action).toBe('open-settings');
  });

  it('허용했지만 카메라가 없으면 지원되지 않는 기기 안내', () => {
    const view = describeCameraPermission('authorized', false);
    expect(view.canShowCamera).toBe(false);
    expect(view.action).toBeNull();
    expect(view.title).toContain('카메라가 없어요');
  });
});

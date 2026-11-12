import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

import type { CaptureFilePort, PhotoLibraryPort } from '@/domain/capture/capture-session';

/** 경로 문자열을 file:// URI로 맞춘다. */
export function toFileUri(pathOrUri: string): string {
  if (pathOrUri.startsWith('file://') || pathOrUri.startsWith('content://')) return pathOrUri;
  return `file://${pathOrUri.startsWith('/') ? '' : '/'}${pathOrUri}`;
}

export const captureFiles: CaptureFilePort = {
  async deleteTemp(uri) {
    const file = new File(toFileUri(uri));
    if (file.exists) file.delete();
  },
};

export const photoLibrary: PhotoLibraryPort = {
  async ensureAddPermission() {
    // writeOnly = true → 사진 추가(Add Only)만 요청한다. 기존 사진은 읽지 않는다.
    const current = await MediaLibrary.getPermissionsAsync(true);
    if (current.granted) return 'granted';
    if (!current.canAskAgain) return 'blocked';
    const requested = await MediaLibrary.requestPermissionsAsync(true);
    if (requested.granted) return 'granted';
    return requested.canAskAgain ? 'denied' : 'blocked';
  },
  async saveToLibrary(uri) {
    await MediaLibrary.Asset.create(toFileUri(uri));
  },
};

const STALE_CAPTURE_PREFIXES = ['gudopick-capture-'];

/**
 * 앱 시작 시 이전 실행에서 남았을 수 있는 촬영 임시 파일을 정리한다.
 * (촬영 직후 앱이 강제 종료된 경우 등)
 */
export function cleanupStaleCaptures(): number {
  let removed = 0;
  try {
    const cache = new Directory(Paths.cache);
    if (!cache.exists) return 0;
    for (const entry of cache.list()) {
      if (entry instanceof File && STALE_CAPTURE_PREFIXES.some((prefix) => entry.name.startsWith(prefix))) {
        entry.delete();
        removed += 1;
      }
    }
  } catch {
    // 정리는 최선 노력(best effort)이다.
  }
  return removed;
}

/** 촬영 임시 파일 경로(캐시 디렉터리)를 만든다. */
export function createTempCapturePath(extension = 'jpg'): string {
  const name = `gudopick-capture-${Date.now()}.${extension}`;
  return new File(Paths.cache, name).uri;
}

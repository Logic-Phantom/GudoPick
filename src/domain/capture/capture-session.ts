/**
 * 촬영 → 검토 → (명시적 저장 | 다시 촬영/취소) 흐름.
 *
 * 규칙
 * - 촬영 원본은 사용자가 저장을 누르기 전까지 임시 캐시에만 있다.
 * - 저장 성공, 다시 촬영, 취소 어느 경로든 임시 파일을 지운다.
 * - 저장 실패 시에는 임시 파일을 남겨 재시도할 수 있게 한다.
 * - 자동 저장은 없다: `save()`는 사용자의 버튼 동작에서만 호출한다.
 *
 * 파일/사진 라이브러리 접근은 주입받는다 → 순수 로직으로 테스트 가능.
 */

export interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
}

export interface CaptureFilePort {
  /** 임시 파일 삭제. 파일이 없어도 실패하지 않아야 한다. */
  deleteTemp(uri: string): Promise<void>;
}

export interface PhotoLibraryPort {
  /** 쓰기 전용(Add Only) 권한을 확인/요청한다. */
  ensureAddPermission(): Promise<'granted' | 'denied' | 'blocked'>;
  /** 사진 앱에 추가한다. */
  saveToLibrary(uri: string): Promise<void>;
}

export type CaptureState =
  | { phase: 'idle' }
  | { phase: 'reviewing'; photo: CapturedPhoto; lastError?: SaveFailure }
  | { phase: 'saving'; photo: CapturedPhoto }
  | { phase: 'saved' };

export type SaveFailure = 'permission-denied' | 'permission-blocked' | 'save-failed';

export type SaveOutcome = { ok: true } | { ok: false; reason: SaveFailure };

export class CaptureSession {
  private state: CaptureState = { phase: 'idle' };

  constructor(
    private readonly files: CaptureFilePort,
    private readonly library: PhotoLibraryPort,
  ) {}

  getState(): CaptureState {
    return this.state;
  }

  /** 새 촬영 결과를 검토 상태로 올린다. 이전 임시 파일이 남아 있으면 지운다. */
  async begin(photo: CapturedPhoto): Promise<void> {
    if (this.state.phase === 'saving') throw new Error('저장 중에는 새 촬영을 시작할 수 없어요.');
    const previous = this.currentUri();
    this.state = { phase: 'reviewing', photo };
    if (previous && previous !== photo.uri) await this.safeDelete(previous);
  }

  /** 사용자가 '저장하기'를 눌렀을 때만 호출한다. */
  async save(): Promise<SaveOutcome> {
    if (this.state.phase !== 'reviewing') return { ok: false, reason: 'save-failed' };
    const photo = this.state.photo;
    this.state = { phase: 'saving', photo };

    let permission: 'granted' | 'denied' | 'blocked';
    try {
      permission = await this.library.ensureAddPermission();
    } catch {
      return this.fail(photo, 'save-failed');
    }
    if (permission === 'denied') return this.fail(photo, 'permission-denied');
    if (permission === 'blocked') return this.fail(photo, 'permission-blocked');

    try {
      await this.library.saveToLibrary(photo.uri);
    } catch {
      // 임시 파일은 그대로 둔다 → 재시도 가능
      return this.fail(photo, 'save-failed');
    }

    this.state = { phase: 'saved' };
    await this.safeDelete(photo.uri);
    return { ok: true };
  }

  /** 다시 촬영 / 취소: 임시 파일을 지우고 처음 상태로 돌아간다. */
  async discard(): Promise<void> {
    if (this.state.phase === 'saving') return;
    const uri = this.currentUri();
    this.state = { phase: 'idle' };
    if (uri) await this.safeDelete(uri);
  }

  private fail(photo: CapturedPhoto, reason: SaveFailure): SaveOutcome {
    this.state = { phase: 'reviewing', photo, lastError: reason };
    return { ok: false, reason };
  }

  private currentUri(): string | null {
    return this.state.phase === 'reviewing' || this.state.phase === 'saving' ? this.state.photo.uri : null;
  }

  private async safeDelete(uri: string): Promise<void> {
    try {
      await this.files.deleteTemp(uri);
    } catch {
      // 정리 실패는 사용자 흐름을 막지 않는다. 다음 실행 시 캐시 정리에서 다시 시도한다.
    }
  }
}

# DATA_MODEL — 로컬 데이터

서버·계정 없음. 모든 데이터는 기기 안 SQLite(`gudopick.db`, expo-sqlite)에 있다.

## 스키마 (v1)

```sql
CREATE TABLE meta (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE presets (
  id              TEXT PRIMARY KEY NOT NULL,
  name            TEXT NOT NULL,           -- 최대 20자, 공백 정리
  answers_json    TEXT NOT NULL,           -- 사용자가 고른 취향(PreferenceAnswers)
  answers_version INTEGER NOT NULL,        -- 답변 스키마 버전 (현재 2)
  cover_key       TEXT NOT NULL,           -- 번들 샘플 이미지 키
  is_default      INTEGER NOT NULL DEFAULT 0,  -- 항상 최대 1개
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX idx_presets_sort ON presets (sort_order, created_at);
```

`meta`에는 `app_settings` 키 하나에 JSON으로 설정을 저장한다.

```ts
interface AppSettings {
  onboardingCompleted: boolean;
  hapticsEnabled: boolean;          // 준비 완료 진동
  guidanceMessagesEnabled: boolean; // 카메라 안내 문구
  shootingTipsEnabled: boolean;     // 카메라 진입 시 도움말
  gridEnabled: boolean;             // 격자 가이드
}

interface PreferenceAnswers {       // presets.answers_json
  mode: 'portrait' | 'food' | 'landscape' | 'ootd';
  style: 'center' | 'thirds' | 'negative' | 'closeup';
  placement: 'center' | 'left' | 'right' | 'top' | 'bottom';
  size: 'small' | 'normal' | 'large';
  aspectRatio: '1:1' | '4:5' | '3:4' | '9:16';
  guidanceIntensity: 'subtle' | 'normal' | 'strong';
  levelGuide: boolean;
}
```

`CompositionProfile`은 저장하지 않는다. 읽을 때마다 `createProfileFromAnswers()`로 계산한다(D-017).

## Migration / 버전 관리

- 스키마: `PRAGMA user_version` + `src/infrastructure/database/migrations.ts`의 `MIGRATIONS` 배열.
  - 버전은 1부터 연속. 각 단계는 트랜잭션으로 실행하고 성공 시에만 버전을 올린다.
  - 이미 배포한 migration은 수정하지 않고 새 버전을 추가한다.
  - DB가 앱보다 최신이면(다운그레이드) 손대지 않고 오류를 낸다.
- 답변 JSON: `answers_version` + `migrateAnswers()`.
  - v1 → v2: `closeUp: boolean` → `size`, `level` → `levelGuide`.
  - 알 수 없는 값·깨진 JSON은 기본값으로 대체한다.

## 저장하지 않는 것

카메라 프레임, 얼굴 이미지/특징, 분석 좌표 이력, 촬영 결과 URI/메타데이터, 위치, 광고 ID, 계정 정보.

## 임시 파일

- 촬영 직후: `<앱 캐시>/gudopick-capture-<timestamp>.jpg`.
- 삭제 시점: 저장 성공 / 다시 찍기 / 검토 화면 이탈 / 다음 앱 시작(`cleanupStaleCaptures`).
- 저장 실패 시에는 남겨 두어 재시도할 수 있다.

## 데이터 초기화 (설정 > 앱 정보)

- 지우는 것: `presets` 전체, `meta` 전체(온보딩 여부·설정), 남아 있는 촬영 임시 파일.
- 지우지 않는 것: **사진 앱에 이미 저장한 사진**(앱이 읽기 권한이 없어 접근하지도 않는다).
- 초기화 후 온보딩으로 돌아간다.

## 첫 실행 데이터

온보딩 완료(또는 건너뛰기) 시 예시 프리셋 4개(카페 감성, 일몰 감성, 인물 중심, 여행 풍경)를 넣는다.
온보딩을 마치면 선택한 취향으로 `내 취향` 프리셋을 만들어 기본으로 지정하고, 건너뛰면 `일몰 감성`이 기본이 된다.

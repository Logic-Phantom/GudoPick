# DECISIONS — 주요 결정 기록

변경 시 기존 항목을 지우지 않고 새 번호로 추가한다. 날짜는 결정일.

| 번호 | 날짜 | 결정 | 이유 / 검토한 대안 |
|---|---|---|---|
| D-001 | 2026-11-11 | Expo SDK 58 / React Native 0.88.1 / New Architecture 사용 | 작업 시점 `latest`. VisionCamera 5·Nitro와 조합이 빌드로 확인됨. 기존 CutPick과 같은 세대라 경험 재사용 가능 |
| D-002 | 2026-11-11 | 카메라는 VisionCamera 5.2.4, 프레임 처리는 `useFrameOutput` + `useAsyncRunner` + Nitro HybridObject | 공식 문서의 v5 경로. v4 API(`useFrameProcessor` 등)는 사용하지 않음. 대안(Expo Modules + CameraX/AVFoundation 직접 구현)은 스파이크가 성공해 채택하지 않음 |
| D-003 | 2026-11-11 | 네이티브 감지 모듈을 `modules/gudopick-vision`(로컬 Nitro 모듈)로 분리하고 `file:` 의존성으로 연결 | 앱 코드와 네이티브 계약(`VisionDetector.nitro.ts`)을 분리. Android/iOS가 같은 스펙에서 생성된 인터페이스를 구현 |
| D-004 | 2026-11-11 | 네이티브 `detect()`는 **동기** 호출, AsyncRunner 스레드에서 ML Kit Task를 기다림 | 반환 시점에 프레임 버퍼 참조가 끝나므로 `finally { frame.dispose() }`로 수명이 단순해짐. 카메라 스레드는 막지 않음. 대안(Promise 반환)은 프레임 수명 관리가 복잡 |
| D-005 | 2026-11-11 | 분석 빈도 제한을 네이티브(`shouldAnalyze(minIntervalMs)`)에서 수행, 기본 150ms(약 6~7회/초) | 워클릿 간 공유 상태 없이 카메라 스레드에서 즉시 판정. 바쁘면 프레임 드롭 |
| D-006 | 2026-11-11 | Android ML Kit는 **모델 번들 방식**(`com.google.mlkit:*`) | 첫 실행 시 모델 다운로드/네트워크 의존 없음. 대가로 APK 크기 증가. Play 서비스 동적 모델(unbundled)은 채택하지 않음 |
| D-007 | 2026-11-11 | 얼굴 감지는 FAST, 랜드마크/윤곽/분류 모두 끔. 객체 감지는 STREAM, 단일 객체, 분류 끔 | 위치·크기만 필요. 신원 식별·감정/외모 추론을 하지 않는다는 제품 원칙 |
| D-008 | 2026-11-11 | ML Kit가 신뢰도를 주지 않으므로 `confidence`는 선택 값으로 두고, 값이 있을 때만 임계값 적용 | 가짜 신뢰도 수치를 만들지 않음 |
| D-009 | 2026-11-11 | 좌표 변환은 순수 함수로 구현하고, 프리뷰·분석·사진을 모두 4:3으로 맞춤. 전면 카메라는 프리뷰가 반전되므로 카메라 위치로 미러 여부 결정 | 실기기 없이 테스트로 고정할 수 있음. 공식 변환 API(`convertFramePointToCameraPoint` → `convertCameraPointToViewPoint`)는 실기기 검증 후 교체 후보. **화각 일치·미러 방향은 미검증** |
| D-010 | 2026-11-11 | UI 테마는 목업을 따른다: 온보딩/홈/프리셋/설정은 밝은 화이트, 카메라/검토는 블랙, 포인트는 라임 1색 | 사용자가 "목업 그대로"를 요청. 마스터 프롬프트의 "다크 우선"과 충돌 → 목업 우선. 색상은 토큰으로만 참조해 추후 다크 테마 추가 가능 |
| D-011 | 2026-11-11 | 하단 내비게이션은 홈/프리셋/설정 3탭, 카메라는 전체 화면 스택 | 목업 구성. 탭 네비게이터 대신 `Slot` + 자체 탭 바로 구현해 라우터 API 변경 영향 최소화 |
| D-012 | 2026-11-12 | 템플릿 기본 의존성 중 쓰지 않는 것 제거: @expo/ui, glass-effect, symbols, web-browser, device, image, font, react-dom, react-native-web, gesture-handler(직접 의존) | 불필요한 네이티브 코드/권한/라이선스 검토 범위 축소 |
| D-028 | 2026-11-12 | `react-native-gesture-handler`를 네이티브 자동 연결에서 제외 (`package.json` → `expo.autolinking.exclude`) | expo-router의 선택적 피어로 npm이 자동 설치하지만, 이 앱이 쓰는 네이티브 Stack은 불러오지 않음(JS Stack/Drawer만 사용). 그대로 두면 Windows 260자 경로 제한으로 앱 CMake 빌드가 실패. **JS Stack이나 Drawer를 쓰게 되면 이 제외를 풀어야 함** |
| D-013 | 2026-11-11 | 아이콘은 `react-native-svg`로 자체 제작, 폰트는 시스템 폰트 | 아이콘 폰트/웹폰트 번들 없이 라이선스 위험 제거 |
| D-014 | 2026-11-11 | 예시 사진은 사용자가 제공한 AI 생성 샘플(zip)만 사용. 구도 도식은 자체 벡터 | 출처 불명 이미지 금지. 기록: `IMAGE_ASSET_ATTRIBUTIONS.md` |
| D-015 | 2026-11-11 | 목업의 "촬영 품질(흔들림/노출/초점)"을 **"촬영 확인(수평/노출/선명도)"**로 변경 | 흔들림과 초점을 구분해 측정할 수 없음 → 가짜 수치 금지 원칙. 수평=셔터 시점 센서값, 노출·선명도=촬영 파일에서 네이티브로 실제 계산. 측정 실패 시 "확인 불가" |
| D-016 | 2026-11-11 | 비율(1:1/4:5/3:4/9:16)은 프리뷰 위 크롭 프레임으로만 표시, 사진은 원본 비율로 저장 | 마스터 프롬프트 요구. 앱 안에 이 사실을 명시. 저장 시 크롭은 후속 과제 |
| D-017 | 2026-11-11 | 프리셋은 `CompositionProfile`이 아니라 사용자의 **선택 값(answers)** 으로 저장하고 프로필은 순수 함수로 매번 계산 | 정책 상수가 바뀌어도 기존 프리셋이 새 계산을 따름. 답변 스키마 버전(`ANSWERS_VERSION`)으로 마이그레이션 |
| D-018 | 2026-11-11 | 저장소 계층은 `SqlDriver` 인터페이스에만 의존. 테스트는 Node 내장 `node:sqlite`로 실제 SQL 실행 | 네이티브 SQLite 없이 migration/CRUD를 실제 SQL로 검증 |
| D-019 | 2026-11-11 | 촬영 결과 메타데이터(URI 등)는 DB에 저장하지 않음 | 쓰기 전용 권한이라 다시 읽을 수 없고, 필요 최소 원칙. 저장 대상: 온보딩 여부·프리셋·설정뿐 |
| D-020 | 2026-11-11 | 사진 저장은 `expo-media-library`의 write-only 권한 + `Asset.create()` | Add Only. 읽기 권한(`READ_MEDIA_*`)은 `granularPermissions: []` + `blockedPermissions`로 차단 |
| D-021 | 2026-11-11 | 사진 EXIF: 위치는 넘기지 않아 기록되지 않음. 카메라가 넣는 방향/제조사/촬영 설정 EXIF는 **제거하지 않음** | 방향 정보가 필요하고, 일반 카메라 앱의 기대 동작. 위치 권한은 요청하지 않음. 실제 저장 파일의 EXIF 확인은 실기기 과제 |
| D-022 | 2026-11-11 | `CameraAdapter` 계약은 타입으로 유지하되, 구현은 VisionCamera 5의 훅 구조에 맞춘 훅(`useSubjectDetection` + 카메라 화면) | v5는 선언형 세션(`<Camera isActive outputs>`)이라 명령형 start/stop을 억지로 감싸지 않음 |
| D-023 | 2026-11-11 | React Compiler(experiments) 비활성화 | 워클릿 콜백을 포함한 미검증 프레임 파이프라인에서 변수를 줄이기 위해. 실기기 검증 후 재검토 |
| D-024 | 2026-11-11 | 목업 문구("완벽한 구도", "가장 좋은 구도로")는 화면에 그대로 사용 | 사용자의 "목업 그대로" 요청. 단 스토어 설명에는 결과 보장 표현을 쓰지 않음 — 소유자 확인 항목(RELEASE_CHECKLIST) |
| D-025 | 2026-11-11 | 홈에 목업에 없는 "빠른 모드" 칩 행을 프리셋 카드 아래에 추가 | 마스터 프롬프트의 필수 화면 요구(빠른 모드). 목업의 빈 영역에 배치 |
| D-026 | 2026-11-11 | 로컬 Android 빌드는 `scripts/android-build.ps1`로 수행, 전역 환경 변수는 건드리지 않음 | CutPick D-035와 같은 방침. 한글 사용자 폴더 문제 회피 설정 포함 |
| D-027 | 2026-11-11 | minSdk 24, 세로 고정(orientation portrait) | VisionCamera 최소 23, ML Kit/Expo 요구 반영. 가로 UI는 범위 밖(좌표 변환 로직과 테스트는 가로 프레임도 지원) |

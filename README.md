# 구도픽 (GudoPick)

> 내 취향으로 맞추는 실시간 구도 코치 카메라

- 문서 기준일: **2026-11-12** (작업: 2026-11-11 ~ 11-12)
- 상태: **코드 구현 + 자동 테스트 + Android 릴리스 APK 빌드까지 완료. 실기기에서는 한 번도 실행하지 못함(미검증)** — 자세한 내용은 [검증 상태](#검증-상태)

구도픽은 사용자가 온보딩에서 고른 사진 취향(대상·구도·위치·크기·비율)을 카메라 가이드로 바꿔, 촬영할 때 피사체의 위치·크기·여백·수평을 실시간으로 안내하는 앱입니다.

- 취향은 사용자가 고르고, 온디바이스 비전 모델은 **위치·크기만** 관측하고, 구도 엔진이 목표와 비교해 안내합니다.
- 자동 촬영·자동 저장·자동 공유, 얼굴 인식(신원 확인), 외모/감정 평가는 **하지 않습니다.**
- 계정·서버·광고·분석 SDK가 없습니다.

## 지원 촬영 모드와 실제 구현 범위

| 모드 | 감지 | 안내 내용 | 제한 |
|---|---|---|---|
| 인물 | ML Kit 얼굴 감지 (FAST, 랜드마크/분류 끔) | 얼굴 위치·크기, 수평 | 가장 큰 얼굴 1명만 |
| 음식·카페(사물) | ML Kit 객체 감지 (스트리밍, 단일 객체, 분류 끔) | 주요 객체 위치·크기, 수평 | 어떤 사물인지는 판단하지 않음 |
| 여행·풍경 | 없음 | 센서 기반 수평 + 격자 | 지평선 인식 아님 |
| OOTD | ML Kit 얼굴 감지 | 얼굴 위치 기준 기본 프레이밍 | 전신 포즈/관절 분석 아님 |

공통: 비율 프레임(1:1 / 4:5 / 3:4 / 9:16), 3분할·중앙 격자, 목표 위치·크기 고스트 가이드, 현재 피사체 박스, 안내 문구, 준비 완료 표시(색+아이콘+문구+선택적 진동), 전/후면 전환, 플래시(지원 기기), 직접 셔터, 촬영 확인 후 명시적 저장.

비율 프레임은 **촬영 참고용**이며 사진은 카메라 원본 비율(4:3)로 저장됩니다.

## 화면

| 화면 | 경로 | 내용 |
|---|---|---|
| 스플래시 | `src/app/index.tsx` | 로고·문구, 로컬 데이터 준비 후 분기 |
| 온보딩 | `src/app/onboarding.tsx` | 대상 → 구도 → 위치/크기 → 비율 → 가이드 강도·수평 (건너뛰기 가능) |
| 홈 | `src/app/(tabs)/home.tsx` | "내 취향으로 촬영하기", 카메라 시작, 내 프리셋, 빠른 모드 |
| 프리셋 | `src/app/(tabs)/presets.tsx` | 선택(기본 지정), 편집 모드에서 수정·복제·삭제, 추가 |
| 프리셋 편집 | `src/app/preset-edit.tsx` | 이름·표지·취향 값, 가이드 미리보기 |
| 카메라 | `src/app/camera.tsx` | 프리뷰 + 가이드 오버레이, 플래시/비율/전환, 셔터, 옵션 시트 |
| 촬영 결과 | `src/app/capture-review.tsx` | 촬영 확인(수평·노출·선명도), 다시 찍기 / 저장하기 |
| 설정 | `src/app/(tabs)/settings.tsx`, `settings/[section].tsx` | 촬영 가이드, 진동, 안내 문구, 개인정보, 오픈소스 라이선스, 앱 정보(데이터 초기화) |

디자인은 제공된 목업을 기준으로 구현했습니다(밝은 화이트 UI + 블랙 카메라 화면 + 라임 포인트). 목업과 다른 점은 [목업 대비 변경점](#목업-대비-변경점)에 적었습니다.

## 기술 스택

| 영역 | 사용 |
|---|---|
| 앱 | Expo SDK 58 (`expo` 58.0.23), React Native 0.88.1 (New Architecture), React 19.3, TypeScript 6, Expo Router |
| 카메라 | `react-native-vision-camera` 5.2.4 — `<Camera>`, `usePhotoOutput`, `useFrameOutput`, `useAsyncRunner` |
| 프레임 처리 | `react-native-vision-camera-worklets` + `react-native-worklets` 0.13 (워클릿), 프레임 드롭 방식 |
| 네이티브 분석 | 자체 Nitro 모듈 `modules/gudopick-vision` (`react-native-nitro-modules` 0.37, nitrogen 생성 바인딩) — Android Kotlin / iOS Swift |
| 비전 모델 | Google ML Kit Face Detection 16.1.7, Object Detection 17.0.2 (Android, 모델 번들) / iOS GoogleMLKit 9.0.0 (미검증) |
| 센서 | `expo-sensors` 가속도계 (수평) |
| 저장 | `expo-sqlite` (프리셋·설정), `expo-file-system` (임시 파일), `expo-media-library` (쓰기 전용 저장) |
| UI | `react-native-svg` (자체 아이콘·도식·오버레이), `expo-linear-gradient`, 시스템 폰트 |
| 테스트 | Jest (`jest-expo`), Node 내장 `node:sqlite`로 DB 통합 테스트 |

### 네이티브 프레임 분석 구조

```text
Frame Output(VGA 4:3, YUV) ─ onFrame 워클릿[카메라 스레드]
  ├─ shouldAnalyze(150ms) 실패 → frame.dispose()            # 빈도 제한 (약 6~7회/초)
  └─ asyncRunner.runAsync
       ├─ 바쁨 → frame.dispose()                           # 큐에 쌓지 않고 드롭
       └─ [AsyncRunner 스레드] detector.detect(frame, kind) # Nitro → ML Kit (동기)
            ├─ scheduleOnRN(좌표 메타데이터)                 # 이미지 바이트는 JS로 넘기지 않음
            └─ finally frame.dispose()
JS: 좌표 변환(프레임→프리뷰→크롭) → GuidanceEngine → SVG 오버레이
```

자세한 설명: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/COMPOSITION_ALGORITHM.md](docs/COMPOSITION_ALGORITHM.md)

## 개발 환경

- Node.js 24, npm 11
- Android: JDK 17, Android SDK(플랫폼/빌드 도구는 Gradle이 요구하는 버전), NDK, CMake 3.22.1
- iOS: macOS + Xcode + CocoaPods (이 저장소는 Windows에서 작업해 iOS 빌드를 하지 못했습니다)
- Expo Go로는 실행할 수 없습니다(네이티브 모듈 포함). 개발 빌드가 필요합니다.

## 설치와 실행

```bash
npm install
```

```bash
npx expo prebuild --platform android
```

```bash
npx expo run:android
```

위 `run:android`는 연결된 기기에 디버그 빌드를 설치하고 Metro에 연결합니다.

### Android 로컬 빌드 (Windows)

전역 환경 변수를 바꾸지 않고 빌드 프로세스에만 JDK 17 / SDK 경로를 지정하는 스크립트입니다. 경로는 `GUDOPICK_JAVA_HOME`, `GUDOPICK_ANDROID_HOME`, `GUDOPICK_GRADLE_HOME`, `GUDOPICK_TMP`, `GUDOPICK_CMAKE_DIR` 환경 변수로 바꿀 수 있습니다.

```bash
npm run android:release
```

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

- 결과물: `android/app/build/outputs/apk/release/app-release.apk` (arm64-v8a)
- **이 APK는 템플릿 디버그 키로 서명됩니다. 개인 테스트 전용이며 배포하면 안 됩니다.**
- Windows에서 사용자 폴더·SDK 경로에 한글이 있거나 긴 경로 지원이 꺼져 있으면 C++ 빌드가 실패합니다. 스크립트가 임시 폴더·CMake 경로를 ASCII 경로로 지정하고 expo.android.cmakeObjectPathMax로 객체 경로를 줄여 우회합니다([docs/TECH_RESEARCH.md](docs/TECH_RESEARCH.md) 6번).

### iOS 빌드 (미검증)

```bash
npx expo prebuild --platform ios
```

```bash
npx expo run:ios --device
```

macOS에서 실행해야 합니다. ML Kit iOS는 정적 프레임워크이므로 Podfile 설정(예: `use_frameworks!` 연동 방식)과 시뮬레이터 아키텍처 지원을 확인해야 할 수 있습니다. Swift 구현(`modules/gudopick-vision/ios/HybridVisionDetector.swift`)은 Android와 같은 계약으로 작성했지만 **한 번도 빌드·실행하지 못했습니다.**

### 네이티브 스펙을 바꿨을 때

```bash
npm run specs
```

`modules/gudopick-vision/src/specs/*.nitro.ts`를 수정한 뒤 실행하면 `nitrogen/generated/`가 다시 만들어집니다.

## ML Kit 모델과 네트워크

- Android는 모델을 앱에 포함하는 방식(`com.google.mlkit:*`)이라 감지 기능을 쓰기 위해 모델을 내려받지 않습니다.
- ML Kit 약관상 입력 이미지와 분석 결과는 기기에서 처리되고 Google로 전송되지 않습니다.
- 다만 ML Kit SDK는 버그 수정·모델/호환 정보 수신과 **성능·사용 지표 전송**을 위해 Google 서버에 접속할 수 있고, 객체 감지는 진단용으로 Firebase Remote Config/Installations를 사용합니다. 그래서 "완전 오프라인"이라고 말하지 않습니다.
- 실제 기기에서의 네트워크 트래픽은 측정하지 않았습니다(미검증).

## 권한과 개인정보

| 권한 | 용도 | 요청 시점 |
|---|---|---|
| 카메라 | 미리보기·구도 안내·촬영 | 카메라 화면에서 설명 후 |
| 사진 추가(쓰기 전용) | "저장하기"를 눌렀을 때 사진 앱에 추가 | 저장 버튼 |

마이크·위치·연락처·사진 읽기·광고 ID는 사용하지 않으며 Android Manifest에서 명시적으로 차단합니다.
기기에 저장하는 것은 온보딩 여부·프리셋·설정뿐이고, 설정 > 앱 정보 > 데이터 초기화로 지울 수 있습니다(사진 앱에 저장한 사진은 유지).
자세한 내용: [docs/PRIVACY.md](docs/PRIVACY.md)

## 비용

- 유료 API·유료 모델·클라우드 추론·백엔드: **없음** (초기 운영비 0원 목표)
- 스토어 등록비, Apple Developer Program, iOS 빌드 환경 등 **배포 비용은 별도**이며 금액은 소유자가 공식 페이지에서 확인해야 합니다([docs/STORE_COMPLIANCE.md](docs/STORE_COMPLIANCE.md)).

## 라이선스와 출처

- npm 패키지 전체 목록: [docs/THIRD_PARTY_NOTICES.md](docs/THIRD_PARTY_NOTICES.md) (`npm run licenses`로 생성)
- 감사 요약과 ML Kit 약관: [docs/LICENSES.md](docs/LICENSES.md) — **ML Kit은 오픈소스가 아니라 Google ML Kit 약관 적용**
- 이미지 출처: [docs/IMAGE_ASSET_ATTRIBUTIONS.md](docs/IMAGE_ASSET_ATTRIBUTIONS.md) — 예시 사진은 AI 생성 샘플, 아이콘·도식은 자체 제작
- 앱 내: 설정 > 오픈소스 라이선스

## 테스트

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run lint
```

실행 결과(2026-11-12)는 [검증 상태](#검증-상태)와 [docs/TESTING.md](docs/TESTING.md)에 있습니다.

## 검증 상태

<!-- VERIFICATION:START -->
| 구분 | 상태 | 내용 |
|---|---|---|
| 공식 문서 조사 | 확인됨 | VisionCamera 5, ML Kit 약관·데이터 공개, Play Target API (2026-11-11~12) |
| 자동 테스트 | **통과** | Jest 5개 스위트 / 111개 테스트 (도메인 로직 + 실제 SQL) |
| 타입 검사 / 린트 | **통과** | `tsc --noEmit`, `expo lint` |
| expo-doctor | 1건 지적 | 설치 이후 나온 Expo 패치 버전 12개 |
| Android 빌드 | **성공** | 릴리스 APK(arm64-v8a, 약 66.6 MB, minSdk 24 / targetSdk 36), 네이티브 모듈·ML Kit 모델·JS 번들 포함 확인 |
| Android 실기기 실행 | **미검증** | 연결된 기기·에뮬레이터가 없어 앱을 한 번도 실행하지 못함 |
| 카메라 실시간 감지 동작 | **미검증** | 코드와 빌드만 확인. 핵심 기능이 실제로 동작한다고 말할 수 없는 상태 |
| 목업과의 화면 일치 | **미검증** | 실행 화면을 보지 못함 |
| iOS 빌드·실행 | **미검증** | Windows 환경. Swift 코드만 작성 |
| 성능(FPS·지연·발열·메모리) | **미검증** | [docs/DEVICE_BENCHMARKS.md](docs/DEVICE_BENCHMARKS.md) |
| 접근성 | **미검증** | 라벨·역할·상태는 코드에 넣음 |
<!-- VERIFICATION:END -->

## 목업 대비 변경점

| 목업 | 구현 | 이유 |
|---|---|---|
| 촬영 결과의 "촬영 품질: 흔들림 / 노출 / 초점" | "촬영 확인: 수평 / 노출 / 선명도" | 흔들림과 초점을 구분해 측정할 수 없어 가짜 수치를 피함. 세 값 모두 실제 측정(측정 실패 시 "확인 불가") |
| 홈: CTA + 내 프리셋 | 그 아래에 "빠른 모드" 칩 추가 | 요구사항의 빠른 모드 |
| 프리셋 목록 | 헤더 오른쪽 "편집"으로 수정·복제·삭제 | 프리셋 CRUD 요구 |
| 온보딩 2단계 | 5단계(위치/크기, 비율, 가이드 강도 추가) | 선택이 실제 가이드 계산에 반영되어야 함 |
| 카메라 왼쪽 아래 썸네일 | 현재 프리셋 표지(누르면 프리셋·옵션 시트) | 사진 보관함을 읽지 않으므로 최근 사진을 표시할 수 없음 |
| 스플래시 배경 | 제공된 300px 샘플을 확대 사용 | 고해상도 원본이 없어 흐릿할 수 있음 |

목업과의 픽셀 단위 일치 여부는 실기기 화면을 확인하지 못해 **미검증**입니다.

## 미구현 · 제한 · 알려진 문제

- 실기기에서 한 번도 실행하지 못했습니다. 아래는 코드상 동작이며 실제 동작은 확인이 필요합니다.
  - 감지 박스와 프리뷰의 정렬(화각 일치), 전면 카메라 좌우 반전 방향
  - 수평선이 기우는 방향(센서 축 부호)
  - 구도 정책 상수(허용 오차, 유지 시간, 크기 범위)와 촬영 확인 임계값
- iOS: 코드만 있고 빌드·실행 미검증. ML Kit 결과 좌표의 회전 변환 확인 필요
- 선택 비율로 저장 시 크롭하지 않음(원본 비율 저장)
- 가로 화면 UI 없음(세로 고정)
- 단체 인물, 전신 포즈, 실제 지평선 인식 없음
- 저성능 기기용 자동 조정(분석 해상도/빈도) 없음, 분석 통계를 보는 화면 없음
- 스플래시 문구 "완벽한 구도", 홈 문구 "가장 좋은 구도로"는 목업 그대로이며 결과를 보장한다는 뜻이 아닙니다. 스토어 문구에는 쓰지 않는 것을 권장합니다
- 개인정보 처리방침의 운영자·문의처가 비어 있음
- `expo-doctor`: 설치 이후 공개된 Expo 패치 버전 12개가 있다는 1건 지적(동작 문제 아님)

## 작업 내역 (2026-11-11 ~ 11-12)

1. 환경·기존 앱(CutPick) 구조 확인, 공식 문서 조사 → [docs/TECH_RESEARCH.md](docs/TECH_RESEARCH.md)
2. Expo SDK 58 프로젝트 생성, 필요한 패키지만 설치, 템플릿 예제·미사용 의존성 제거
3. Nitro 모듈 `gudopick-vision` 작성: 스펙, Android(Kotlin, ML Kit), iOS(Swift, ML Kit), nitrogen 생성
4. 구도 도메인: 좌표 변환, 취향→프로필, 목표 계산, 안내 엔진, 수평, 촬영 상태 기계, 사진 지표 판정
5. 로컬 DB: migration, 프리셋/설정 저장소
6. 화면: 스플래시, 온보딩, 홈, 프리셋, 프리셋 편집, 카메라, 촬영 결과, 설정 6종
7. 자체 아이콘·로고·구도 도식, 샘플 이미지 연결
8. 테스트 111개, typecheck, lint
9. Android 빌드 환경 문제 4건 해결(한글 임시 경로, CMake 경로, Gradle 데몬 핸들, Windows 260자 경로) 후 릴리스 APK 빌드 성공
10. 문서: 계획, 결정 기록(D-001~D-028), 아키텍처, 알고리즘, 데이터 모델, 개인정보, 라이선스, 스토어, 체크리스트, 테스트

### 마스터 프롬프트 대비 검토·변경한 점

- 테마: "다크 우선" 대신 목업의 밝은 UI를 따름 (D-010)
- 탭: 카메라를 탭이 아닌 전체 화면으로, 탭은 홈/프리셋/설정 3개 (D-011)
- `CameraAdapter`: VisionCamera 5의 선언형 구조에 맞춰 훅으로 구현, 계약 타입은 유지 (D-022)
- 프리셋 저장: 프로필 대신 선택 값을 저장하고 프로필은 계산 (D-017)
- 촬영 결과 메타데이터는 저장하지 않음 (D-019)
- ML Kit 신뢰도: SDK가 제공하지 않아 선택 값으로 처리 (D-008)
- 분석 빈도 제한을 네이티브에서 수행, 동기 detect로 프레임 수명 단순화 (D-004, D-005)
- 템플릿 기본 의존성 정리로 네이티브 코드·권한·라이선스 범위 축소 (D-012, D-028)
- React Compiler 비활성화 (D-023)

전체 결정 기록: [docs/DECISIONS.md](docs/DECISIONS.md)

## 앞으로 할 일 (우선순위 순)

1. **Android 실기기에서 APK 실행** — 미리보기, 감지 박스 정렬, 미러, 수평 부호, 촬영·저장 확인 ([docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md) A)
2. 실기기 결과로 좌표·정책 상수 보정, [docs/DEVICE_BENCHMARKS.md](docs/DEVICE_BENCHMARKS.md) 기록
3. macOS에서 iOS 빌드와 검증
4. 고해상도 스플래시 이미지, 목업 대비 시각 QA, 접근성(TalkBack/VoiceOver) 점검
5. 저장 시 선택 비율 크롭, 공식 좌표 변환 API 적용 검토
6. 스토어 준비

## 스토어 출시 전 소유자 작업

- 운영자명·문의 이메일, 개인정보 처리방침 공개 URL
- 앱 이름 상표·중복 확인(KIPRIS, Play, App Store), 패키지/번들 ID `app.gudopick.mobile` 확정
- 업로드 키/서명 설정(현재 APK는 디버그 키), EAS 프로젝트 연결(로그인 필요)
- Play Data Safety, App Privacy 작성, 콘텐츠 등급
- 실제 화면 스크린샷
- 샘플 이미지의 이용 약관 재확인, 저장소 라이선스 결정

전체 목록: [docs/RELEASE_CHECKLIST.md](docs/RELEASE_CHECKLIST.md)

## 문서

| 문서 | 내용 |
|---|---|
| [IMPLEMENTATION_PLAN](docs/IMPLEMENTATION_PLAN.md) | 단계별 완료 조건과 상태 |
| [DECISIONS](docs/DECISIONS.md) | 결정 기록 |
| [TECH_RESEARCH](docs/TECH_RESEARCH.md) | 공식 문서 조사, 버전, 빌드 문제 재현 기록 |
| [ARCHITECTURE](docs/ARCHITECTURE.md) | 구조와 데이터 흐름 |
| [COMPOSITION_ALGORITHM](docs/COMPOSITION_ALGORITHM.md) | 구도 엔진 |
| [DATA_MODEL](docs/DATA_MODEL.md) | 로컬 데이터 |
| [TESTING](docs/TESTING.md) | 테스트와 실행 결과 |
| [DEVICE_BENCHMARKS](docs/DEVICE_BENCHMARKS.md) | 기기 측정(미검증) |
| [PRIVACY](docs/PRIVACY.md) | 개인정보 원칙과 처리방침 초안 |
| [LICENSES](docs/LICENSES.md) / [THIRD_PARTY_NOTICES](docs/THIRD_PARTY_NOTICES.md) | 라이선스 |
| [IMAGE_ASSET_ATTRIBUTIONS](docs/IMAGE_ASSET_ATTRIBUTIONS.md) | 이미지 출처 |
| [STORE_COMPLIANCE](docs/STORE_COMPLIANCE.md) | 스토어 정책 준비 |
| [RELEASE_CHECKLIST](docs/RELEASE_CHECKLIST.md) | 출시 전 체크리스트 |

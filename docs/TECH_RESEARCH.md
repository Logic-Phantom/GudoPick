# TECH_RESEARCH — 기술 조사 기록

- 확인일: 2026-11-11 ~ 2026-11-12
- 원칙: 기억/과거 예제가 아니라 **작업 시점의 공식 문서·npm 메타데이터·설치된 패키지 소스**를 기준으로 한다.

## 1. 버전 확인 (npm 메타데이터, `npm view`)

| 패키지 | 확인한 최신 | 설치 버전 | 라이선스 | 비고 |
|---|---|---|---|---|
| expo | 58.0.23 | ~58.0.23 | MIT | `create-expo-app@latest` 기본 템플릿 |
| react-native | 0.88.1 | 0.88.1 | MIT | Expo SDK 58이 지정한 버전 |
| react | — | 19.3.0 | MIT | |
| expo-router | 58.0.30 | ~58.0.30 | MIT | |
| react-native-vision-camera | 5.2.4 (`latest`) | ^5.2.4 | MIT | peer: nitro-modules, nitro-image |
| react-native-vision-camera-worklets | 5.2.4 | ^5.2.4 | MIT | peer: react-native-worklets |
| react-native-worklets | 0.13.1 | 0.13.0 | MIT | Expo SDK 58 호환 버전(`expo install`이 고정) |
| react-native-nitro-modules | 0.37.2 | ^0.37.2 | MIT | |
| react-native-nitro-image | 0.15.2 | ^0.15.2 | MIT | VisionCamera 사진 출력이 요구 |
| nitrogen (dev) | 0.37.2 | ^0.37.2 | MIT | Nitro 스펙 코드 생성기 |
| expo-sqlite / expo-media-library / expo-sensors / expo-file-system / expo-haptics | 58.x | SDK 58 호환 | MIT | `npx expo install`로 설치 |
| react-native-svg | 15.16.1 | 15.16.0 | MIT | Expo SDK 58 호환 버전 |

네이티브 SDK

| SDK | 확인 방법 | 사용 버전 |
|---|---|---|
| ML Kit Face Detection (Android, 모델 번들) | Google Maven `com/google/mlkit/group-index.xml` | `com.google.mlkit:face-detection:16.1.7` |
| ML Kit Object Detection (Android, 모델 번들) | 같음 | `com.google.mlkit:object-detection:17.0.2` |
| GoogleMLKit (iOS CocoaPods) | CocoaPods trunk API | `~> 9.0.0` (FaceDetection, ObjectDetection) — **빌드 미검증** |
| AndroidX CameraX | VisionCamera 5.2.4 `android/build.gradle` | 1.7.0-alpha03 (VisionCamera가 지정) |

## 2. 확인한 공식 문서

| 주제 | URL | 결론 |
|---|---|---|
| VisionCamera Frame Output | https://visioncamera.margelo.com/docs/frame-output | v5에서 Frame Processor는 `useFrameOutput({ onFrame })`. `react-native-vision-camera-worklets` + `react-native-worklets` 필요. 프레임은 반드시 `frame.dispose()`. YUV가 RGB보다 효율적 |
| Async Frame Processing | https://visioncamera.margelo.com/docs/async-frame-processing | `useAsyncRunner()`; `runAsync()`가 `false`면 바쁜 상태 → 그 프레임은 즉시 dispose(드롭) |
| Native Frame Processor Plugins | https://visioncamera.margelo.com/docs/native-frame-processor-plugins | v5 플러그인은 **Nitro Module(HybridObject)**. 스펙에서 `Frame` 타입을 받고, Kotlin은 `NativeFrame.image`(CameraX `ImageProxy`), Swift는 `NativeFrame.sampleBuffer`로 꺼낸다 |
| ML Kit Terms & Privacy (2025-05-14 수정) | https://developers.google.com/ml-kit/terms | 입력 데이터 처리는 온디바이스, 입력·출력은 Google 서버로 보내지 않음. 단 버그 수정·모델 업데이트·하드웨어 호환 정보 수신과 **API 성능/사용 지표 전송**이 있음 → 앱이 사용자에게 알릴 책임 |
| ML Kit Android 데이터 공개 | https://developers.google.com/ml-kit/android-data-disclosure | 기기/앱 정보, 설치당 식별자, 성능 지표, API 구성, 이벤트/오류 코드 수집. **object-detection은 진단용으로 Firebase Remote Config + Firebase Installations 사용** |
| Play Target API | https://support.google.com/googleplay/android-developer/answer/11926878 | 2026-08-31부터 신규 앱·업데이트는 API 36 이상(연장 신청 시 2026-11-01까지) |

설치된 패키지 소스로 직접 확인한 것 (`node_modules/react-native-vision-camera`)

- `src/hooks/useFrameOutput.ts`: 옵션 `targetResolution`, `pixelFormat`('native' 기본), `dropFramesWhileBusy`(기본 true), `onFrame`, `onFrameDropped`.
- `src/specs/instances/Frame.nitro.ts`: `orientation`, `isMirrored`는 **버퍼를 물리적으로 돌리거나 뒤집지 않고 플래그로만 제공**. ML Kit에는 이 방향 값을 그대로 넘기라고 명시.
- `android/.../public/NativeFrame.kt`: `val image: ImageProxy`. `ios/Public/NativeFrame.swift`: `sampleBuffer: CMSampleBuffer?`.
- `src/specs/outputs/CameraPhotoOutput.nitro.ts`: `capturePhoto(settings, callbacks) → Photo`, `Photo.saveToFileAsync(path)`, `flashMode`, `location`(넘기지 않으면 위치 미기록).
- `src/hooks/usePermission.ts`: `useCameraPermission()` → `status`('not-determined' | 'authorized' | 'denied' | 'restricted').
- Expo Config Plugin은 제공하지 않음 → 카메라 권한/설명 문구는 `app.json`에서 직접 선언.

## 3. 호환성 표

| 조합 | 결과 |
|---|---|
| Expo SDK 58 + RN 0.88.1 + New Architecture | Android 빌드 성공 (docs/TESTING.md) |
| VisionCamera 5.2.4 + nitro-modules 0.37.2 + nitro-image 0.15.2 | Android 컴파일·링크 성공 |
| 자체 Nitro 모듈이 VisionCamera `Frame`을 인자로 받음 | nitrogen 0.37.2가 `<VisionCamera/HybridFrameSpec.hpp>` / `JHybridFrameSpec`을 참조하는 코드를 생성, CMake `find_package(react-native-vision-camera)`로 링크 성공 |
| ML Kit face-detection 16.1.7 / object-detection 17.0.2 + CameraX 1.7.0-alpha03 | Kotlin 컴파일 성공 |
| iOS (GoogleMLKit 9.0.0 + VisionCamera pod) | **미검증** (Windows 환경, macOS/Xcode 없음) |

## 4. v4 예제를 쓰지 않았는지 점검

사용하지 않은 것: `useFrameProcessor`, `FrameProcessorPlugin`, `VISION_EXPORT_SWIFT_FRAME_PROCESSOR`, `react-native-worklets-core`, `runAtTargetFps`, `Camera.requestCameraPermission()`(v4 정적 API).

## 5. 좌표 변환 API 검토

VisionCamera 5는 `frame.convertFramePointToCameraPoint()`와 `PreviewView.convertCameraPointToViewPoint()`를 제공한다(공식 경로: 프레임 → 센서 → 뷰).
이번 구현은 프리뷰·분석·사진을 모두 4:3으로 맞추고 순수 함수(`coordinate-mapper.ts`)로 변환했다. 이유와 한계는 `DECISIONS.md` D-009 참고.
**프리뷰와 분석 프레임의 화각이 실제로 일치하는지는 실기기 확인이 필요하다.**

## 6. 빌드 환경에서 발견한 문제 (재현 기록)

| 증상 | 원인 | 해결 |
|---|---|---|
| `configureCMakeDebug` 실패: `'-enable-native-access'은(는) 내부 또는 외부 명령이 아닙니다` | AGP prefab 단계가 만드는 배치 파일에 사용자 임시 폴더 경로(한글 사용자명)가 들어가 인코딩이 깨짐 | 빌드 프로세스의 `TEMP`/`TMP`/`java.io.tmpdir`를 ASCII 경로로 지정 (`scripts/android-build.ps1`) |
| `buildCMakeDebug` 실패: `A problem occurred starting process ... ninja.exe` | Android SDK 폴더가 한글이 포함된 실제 경로로 연결된 링크 → ninja 실행 경로에 비ASCII 문자 | `local.properties`의 `cmake.dir`를 ASCII 경로의 CMake로 지정 |
| 로그 리다이렉션이 끝나지 않음, 이후 빌드가 로그 파일을 못 엶 | Gradle 데몬이 출력 핸들을 상속해 계속 보유 | `--no-daemon` |
| `ninja: error: Stat(...cpp.o): Filename longer than 260 characters`, `mkdir(...): No such file or directory` | Windows 긴 경로 지원 꺼짐(`LongPathsEnabled=0`) + Expo가 `CMAKE_OBJECT_PATH_MAX=1024`를 넘겨 CMake가 경로를 줄이지 않음 (gesture-handler, reanimated codegen에서 발생) | Expo 공식 Gradle 속성 `-Pexpo.android.cmakeObjectPathMax=230` → CMake가 긴 객체 경로를 해시로 단축. 근거: `expo-modules-autolinking`의 `ExpoRootProjectPlugin.kt` 주석. 시스템 설정(긴 경로 사용)은 바꾸지 않았다. 쓰지 않는 gesture-handler는 자동 연결에서도 제외(D-028) |

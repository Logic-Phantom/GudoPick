# TESTING — 테스트와 검증 기록

- 기준일: 2026-11-12
- 원칙: 실행하지 않은 것은 통과로 적지 않는다.

## 1. 요약

| 항목 | 결과 | 비고 |
|---|---|---|
| `npm test` (Jest) | **5개 스위트, 111개 테스트 모두 통과** | 2026-11-12 실행 |
| `npm run typecheck` (`tsc --noEmit`) | **통과** | |
| `npm run lint` (`expo lint`) | **통과** (오류·경고 0) | |
| `npx expo-doctor` | **1건 지적** | 설치 이후 공개된 Expo 패치 버전 12개(예: expo-router 58.0.30 → 58.0.31). 빌드·테스트는 설치된 버전 기준. `npx expo install --fix` 후 재빌드 필요 |
| Android 릴리스 APK 빌드 (`npm run android:release`) | **성공** | arm64-v8a, JS 번들 포함. 아래 3번 |
| Android 실기기/에뮬레이터 실행 | **미검증** | `adb devices`에 연결된 기기 없음, 에뮬레이터 이미지 없음 |
| iOS 빌드·실행 | **미검증** | Windows 환경(macOS/Xcode 없음) |
| 성능 측정 | **미검증** | `DEVICE_BENCHMARKS.md` |
| 접근성(TalkBack/VoiceOver), 큰 글자 | **미검증** | 코드에 라벨·역할·상태만 넣음 |

핵심 기능인 **카메라 실시간 감지가 실제 기기에서 동작하는지는 확인하지 못했다.**

## 2. 자동 테스트 범위

| 파일 | 대상 | 확인 내용 |
|---|---|---|
| `tests/unit/profile-factory.test.ts` | 취향→프로필, 목표 영역, 답변 마이그레이션 | 위치/여백/3분할/크기/비율/강도 반영, 순수 함수성, 프레임 밖으로 나가지 않음, v1→v2 변환, 깨진 값 기본값 처리, 예시 프리셋 유효성 |
| `tests/unit/coordinate-mapper.test.ts` | 좌표 변환 | 회전(up/right/left/down, 역변환, 넓이 보존), 전면 미러 대칭, cover/contain, 크기 미상 시 null, 크롭 프레임(4개 비율·inset·역변환), 가로 프레임, 네이티브 결과 매핑 |
| `tests/unit/guidance-engine.test.ts` | 안내 엔진, 수평 | 탐색/유실 유예/오래된 결과 무시, 저신뢰 unavailable, detector 미사용, 방향(좌우상하·가까이·멀리), 여백 문구, dead zone, 히스테리시스(진입/이탈), EMA, 중복 평활화 방지, 추적 대상 변경, 방향 전환 지연, ready 유지 시간과 재시작, 수평 조건, 풍경 모드, 수평 계산·눕힘 처리 |
| `tests/unit/capture-session.test.ts` | 촬영 흐름, 사진 지표, 권한 안내 | 자동 저장 없음, 저장 시 임시 파일 삭제, 다시 찍기/취소 정리, 저장 실패 후 재시도, 권한 거부→재요청, 영구 거부→설정 안내, 정리 실패 내성, 노출/선명도/수평 판정, "확인 불가" 처리, 카메라 권한 4개 상태 안내 |
| `tests/integration/database.test.ts` | SQLite(실제 SQL, `node:sqlite`) | migration 적용/재실행/추가 단계/실패 롤백/다운그레이드 거부/버전 연속성, 프리셋 생성·수정·복제·기본 지정·삭제·이름 정리, 깨진 JSON·구버전 답변 읽기, 예시 프리셋 시드, 설정 저장/부분 갱신/손상 값, 데이터 초기화 |

테스트로 다루지 못한 것

- 네이티브 코드(Kotlin/Swift): ML Kit 호출, 프레임 수명, 스레드, 사진 지표 계산
- 워클릿(`onFrame`)과 `scheduleOnRN` 전달
- 화면 렌더링/내비게이션(컴포넌트 테스트 없음), 실제 파일·사진 라이브러리·센서
- Mock detector는 만들지 않았다(엔진 테스트는 관측값을 직접 넣는다). 화면에 가짜 감지 결과를 표시하는 코드는 없다.

## 3. Android 빌드 기록

환경: Windows 11, JDK 17(Microsoft 17.0.20), Gradle 9.4.1, NDK 27.1.12297006, CMake 3.22.1, build-tools 37.0.0.

| 날짜 | 명령 | 결과 |
|---|---|---|
| 2026-11-11 | `assembleDebug` | 실패 — prefab 배치 파일에서 한글 임시 경로 깨짐 → `TEMP` 지정으로 해결 |
| 2026-11-11 | `assembleDebug` | 실패 — SDK 링크의 한글 실제 경로로 ninja 실행 실패 → `cmake.dir` 지정으로 해결 |
| 2026-11-12 | `assembleDebug` | 라이브러리 모듈(구도픽 비전 모듈 포함) 컴파일 성공, 앱 CMake에서 260자 경로 제한으로 실패 |
| 2026-11-12 | `assembleRelease` | 같은 제한으로 실패(gesture-handler, reanimated codegen) |
| 2026-11-12 | `assembleRelease` + `-Pexpo.android.cmakeObjectPathMax=230` | **BUILD SUCCESSFUL** (19분 44초) |
| 2026-11-12 | 권한 차단 추가 후 `assembleRelease` | **BUILD SUCCESSFUL** (23분 11초) |

원인·해결 상세: `TECH_RESEARCH.md` 6번.

### APK 점검 (aapt2 dump badging, 2026-11-12)

| 항목 | 값 |
|---|---|
| 패키지 | `app.gudopick.mobile`, versionName 0.1.0, versionCode 1 |
| 앱 이름 | 구도픽 |
| minSdk / targetSdk / compileSdk | 24 / 36 / 37 |
| ABI | arm64-v8a (스크립트 기본값. 다른 ABI는 `-Architectures`로 지정) |
| 크기 | 약 66.6 MB (ML Kit 네이티브 라이브러리 약 19 MB, 번들 모델 포함) |
| 서명 | 템플릿 디버그 키 — **배포 금지** |

포함 확인: `libNitroGudopickVision.so`, `libVisionCamera.so`, `libVisionCameraWorklets.so`, `libface_detector_v2_jni.so`, `libmlkitcommonpipeline.so`, 얼굴 모델(`assets/models_bundled/fssd_*.tflite`), 객체 감지 모델(`assets/mlkit_odt_localizer/*`), JS 번들(`assets/index.android.bundle`).

메모: 객체 감지 AAR이 분류 모델(`mlkit_odt_default_classifier`)도 함께 넣는다. 앱은 분류를 켜지 않으므로 사용하지 않지만 용량에는 포함된다.

### 최종 권한 (병합 Manifest)

| 권한 | 출처 | 판단 |
|---|---|---|
| `CAMERA` | app.json | 필요 |
| `VIBRATE` | expo-haptics | 필요(준비 완료 진동) |
| `INTERNET` | Expo/React Native 기본, ML Kit | 앱 코드는 네트워크 요청을 하지 않음. ML Kit 지표 전송에 쓰일 수 있음(PRIVACY.md). 제거하지 않음 |
| `ACCESS_NETWORK_STATE` | Google 전송 라이브러리(ML Kit 전이 의존성) | SDK 요구. 유지 |
| `WRITE_EXTERNAL_STORAGE` (maxSdk 32) | expo-media-library / expo-file-system | Android 9 이하에서 사진 저장에 필요. Android 13+에는 적용되지 않음 |
| `READ_EXTERNAL_STORAGE` (maxSdk 32, 암시적) | `WRITE_EXTERNAL_STORAGE` 선언에 따른 aapt의 암시 권한 | 앱이 선언한 것은 아님(선언은 `tools:node="remove"`로 제거됨). 구형 OS 한정 |
| `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` | AndroidX | 앱 내부용 |
| `ACTIVITY_RECOGNITION` | expo-sensors(만보기) | **불필요 → 2026-11-12 차단 목록에 추가.** 재빌드 후 제거 여부는 아래 "재확인" 참고 |

없음 확인: `RECORD_AUDIO`, 위치, `READ_MEDIA_*`, `MANAGE_EXTERNAL_STORAGE`, `AD_ID`.

<!-- RECHECK:START -->
**재확인 (2026-11-12, 차단 후 재빌드 — BUILD SUCCESSFUL 23분 11초):** `ACTIVITY_RECOGNITION`이 최종 APK에서 제거됨을 aapt2로 확인. 남은 권한: `CAMERA`, `INTERNET`, `VIBRATE`, `ACCESS_NETWORK_STATE`, `WRITE_EXTERNAL_STORAGE`(maxSdk 32, 그에 따른 암시적 `READ_EXTERNAL_STORAGE` maxSdk 32), 내부용 `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. 이 APK에는 린트 수정 이후의 최신 JS가 번들되어 있다.
<!-- RECHECK:END -->

## 4. 실기기 테스트 체크리스트 (모두 미실행)

`RELEASE_CHECKLIST.md` A 항목과 같다. 요약:

- 첫 설치, 카메라 권한 허용/거부/다시 허용, 설정 이동
- 전면/후면 전환, 플래시, 촬영, 저장, 저장 권한 거부
- 얼굴/음식/사물 감지 성공·실패, 박스 정렬, 미러, 수평 방향
- 어두운 곳·역광·복잡한 배경·작은 피사체, 피사체 이탈 시 안내 복귀
- 10분 이상 실행(발열·배터리·메모리), 백그라운드/복귀/전화 인터럽트, 카메라 점유
- 저장 사진의 방향·크기·EXIF
- TalkBack/VoiceOver, 큰 글자, 명암 대비

## 5. 실행 방법

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npx expo-doctor
```

```bash
npm run android:release
```

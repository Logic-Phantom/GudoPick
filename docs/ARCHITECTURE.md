# ARCHITECTURE

## 폴더 구조와 역할

```text
src/
├── app/                      # Expo Router 화면 (파일 = 화면)
│   ├── _layout.tsx           # 루트 Stack + AppDataProvider
│   ├── index.tsx             # 스플래시/첫 실행 → 온보딩 또는 홈으로 분기
│   ├── onboarding.tsx        # 취향 선택 5단계
│   ├── (tabs)/               # 홈 / 프리셋 / 설정 (자체 하단 탭 바)
│   ├── camera.tsx            # 카메라 + 가이드 오버레이
│   ├── capture-review.tsx    # 촬영 결과: 다시 찍기 / 명시적 저장
│   ├── preset-edit.tsx       # 프리셋 생성·수정
│   └── settings/[section].tsx# 설정 하위 화면 6종
├── design-system/            # 토큰(색·간격·글자) + 공통 컴포넌트 + 자체 SVG 아이콘
├── domain/                   # 순수 TypeScript. UI/SDK 의존 없음 → 단위 테스트 대상
│   ├── composition/          # 좌표 변환, 목표 계산, 안내 엔진, 수평, 문구, 정책 상수
│   ├── preferences/          # 취향 → 프로필 변환, 프리셋 모델, 답변 마이그레이션
│   └── capture/              # 촬영→검토→저장 상태 기계, 사진 지표 판정
├── features/                 # 화면에 붙는 기능 단위 (훅/컴포넌트)
│   ├── app-data/             # DB 로딩, 설정·프리셋 컨텍스트
│   ├── subject-detection/    # VisionCamera Frame Output ↔ 네이티브 감지 훅
│   ├── guidance/             # 감지 결과 + 센서 → 안내 상태 훅
│   ├── camera/               # 가이드 오버레이, 권한 안내
│   ├── onboarding/           # 선택 카드, 구도 도식(SVG)
│   └── preferences/          # 선택지 정의
├── infrastructure/           # 플랫폼 어댑터
│   ├── database/             # SqlDriver, migration, 저장소(프리셋/설정), expo-sqlite 클라이언트
│   ├── files/                # 임시 파일, 사진 라이브러리(Add Only)
│   └── native-vision/        # Nitro 모듈 래퍼, 결과 매핑
└── shared/                   # 샘플 이미지 등록, 법적 문구, 생성된 라이선스 목록

modules/gudopick-vision/      # 로컬 Nitro 모듈 (Kotlin / Swift)
├── src/specs/VisionDetector.nitro.ts   # 플랫폼 공통 계약(스펙)
├── android/.../HybridVisionDetector.kt # ML Kit (Android) 구현
├── ios/HybridVisionDetector.swift      # ML Kit (iOS) 구현 — 빌드 미검증
└── nitrogen/generated/                 # nitrogen이 생성한 C++/Kotlin/Swift 바인딩 (수정 금지)
```

## 실시간 데이터 흐름

```text
카메라 센서
 └─ VisionCamera <Camera outputs=[photoOutput, frameOutput]>   (프리뷰·분석·사진 모두 4:3)
     └─ Frame Output (VGA 4:3, YUV, dropFramesWhileBusy)
         └─ onFrame 워클릿 [카메라 스레드]
             ├─ detector.shouldAnalyze(150ms) == false → frame.dispose()  (빈도 제한)
             └─ asyncRunner.runAsync(...)
                 ├─ false(분석 중) → frame.dispose()                       (큐 누적 없음, 드롭)
                 └─ [AsyncRunner 스레드]
                     ├─ detector.detect(frame, 'face' | 'object')   ← Nitro HybridObject (Kotlin/Swift)
                     │     └─ ML Kit (동기 대기) → 정규화 좌표 1건 또는 없음
                     ├─ scheduleOnRN(deliver, result)               ← 좌표 메타데이터만 JS로
                     └─ finally { frame.dispose() }
 JS(RN) 스레드
 └─ toDetectionResult()  →  useGuidance
     ├─ mapDetectionToCrop(): 프레임 → 프리뷰(cover, 미러) → 크롭 프레임 정규 좌표
     ├─ GuidanceEngine.update(): 평활화 · dead zone · 히스테리시스 · 유예/유효기간 · ready 유지 시간
     └─ GuideOverlay (react-native-svg): 크롭 마스크 / 격자 / 목표 브래킷 / 피사체 박스 / 수평선 / 문구
 가속도 센서(expo-sensors) → rollFromGravity() → GuidanceEngine (수평)
```

핵심 규칙

- 이미지 바이트는 JS로 넘어오지 않는다. 넘어오는 것은 박스 좌표·프레임 크기·추적 ID·분석 시간뿐이다.
- 분석이 느려도 프리뷰와 셔터는 영향을 받지 않는다(분석은 별도 스레드, 초과 프레임은 버림).
- 화면 이탈/백그라운드/모드 변경 시 `isActive=false`, 분석 중단, `detector.close()`, 센서 구독 해제.
- 감지 결과가 없으면 피사체 박스를 그리지 않는다. 풍경 모드는 detector를 붙이지 않는다.

## 촬영 흐름

```text
셔터(사용자 탭)
 └─ photoOutput.capturePhoto({ flashMode })           # 위치 미전달
     └─ photo.saveToFileAsync(<앱 캐시>/gudopick-capture-<ts>.jpg)
         └─ /capture-review (CaptureSession)
             ├─ 네이티브 analyzePhoto(): 밝기·선명도 계산 → "촬영 확인"
             ├─ [다시 찍기 / 뒤로] → 임시 파일 삭제
             └─ [저장하기] → 쓰기 전용 권한 확인 → MediaLibrary.Asset.create() → 임시 파일 삭제
앱 시작 시 cleanupStaleCaptures(): 이전 실행에서 남은 gudopick-capture-* 삭제
```

## 네이티브 계약 (`VisionDetector.nitro.ts`)

| 메서드 | 스레드 | 설명 |
|---|---|---|
| `shouldAnalyze(minIntervalMs): boolean` | 카메라 스레드 | 분석 빈도 제한 |
| `detect(frame, kind): VisionDetection \| undefined` | AsyncRunner | 프레임 1장 동기 분석. 반환 후 버퍼 미참조 |
| `analyzePhoto(path): Promise<PhotoMetricsResult \| undefined>` | 백그라운드 | 촬영 파일의 밝기 통계·라플라시안 분산 |
| `getStats()` | 임의 | 분석 횟수/실패/평균 소요 시간(벤치마크용) |
| `close()` | 임의 | detector 해제(다음 분석 때 지연 재생성) |

`VisionDetection`의 좌표는 "똑바로 세운 프레임" 기준 0..1이며 미러링은 적용하지 않는다(프리뷰 미러는 JS에서 처리).

## 상태 관리

- 전역: `AppDataProvider`(React Context) — 설정, 프리셋 목록, 기본 프리셋, CRUD 함수. 외부 상태 라이브러리 없음.
- 카메라 화면: 지역 상태 + `useGuidance`(약 150ms 주기 평가, 값이 달라질 때만 리렌더).

## 의존 방향

`app → features → domain` / `features → infrastructure → domain`. `domain`은 어떤 것도 import하지 않는다(React Native 포함).

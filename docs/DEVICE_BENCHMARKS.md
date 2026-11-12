# DEVICE_BENCHMARKS — 기기 성능 측정

## 현재 상태: **미검증**

2026-11-12 기준, 개발 PC에 연결된 Android 기기·에뮬레이터가 없고(`adb devices` 결과 없음) iOS 빌드 환경(macOS)도 없어 **실기기 측정을 한 번도 하지 못했다.** 아래 표는 비어 있으며, 값을 채우기 전에는 성능 기준을 통과했다고 말할 수 없다.

## 측정 방법

1. 릴리스 빌드 설치: `npm run android:release` → `adb install -r android/app/build/outputs/apk/release/app-release.apk`
2. 카메라 화면에서 모드별로 2분 이상 사용
3. 분석 통계: 네이티브 `VisionDetector.getStats()` (분석 횟수, 실패 수, 마지막/평균 분석 시간). `useSubjectDetection().getStats()`로 읽을 수 있다 — 화면 표시는 아직 없으므로 임시 로그로 확인
4. 프레임 드롭/UI: `adb shell dumpsys gfxinfo app.gudopick.mobile`
5. 메모리: `adb shell dumpsys meminfo app.gudopick.mobile` (시작, 5분, 10분)
6. 발열·배터리: 10분 연속 실행 전후 `adb shell dumpsys battery`, 체감 발열

## 내부 목표 (초기값, 측정 후 조정)

- 분석 빈도 5~8회/초 (제한 간격 150ms)
- 프리뷰가 끊기지 않을 것, 분석 큐 누적 없음(구조상 드롭)
- 10분 실행 시 크래시·메모리 지속 증가 없음

## 측정 기록

| 날짜 | 기기 | OS | 빌드 | 모드 | 프리뷰 FPS | 분석 빈도(회/초) | 분석 지연 평균 / 95p (ms) | 드롭 프레임 | 메모리(시작→10분) | 배터리/발열 | 비고 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | 미측정 | 실기기 없음 |

권장 기기: 중급/최신 Android 1대, 최소 지원(API 24)에 가까운 Android 1대, 최근 iPhone 1대, 최소 지원 iOS에 가까운 iPhone 1대.

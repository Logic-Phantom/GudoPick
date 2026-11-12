# LICENSES — 라이선스·약관 감사

- 작성일: 2026-11-12
- npm 패키지 전체 목록: `docs/THIRD_PARTY_NOTICES.md` (자동 생성, `npm run licenses`)
- 앱 내 표시: 설정 > 오픈소스 라이선스

> 이 문서는 법률 자문이 아니다. 출시 전 소유자가 다시 검토한다.

## 1. 요약

- 유료 API·유료 모델·클라우드 추론·백엔드: **사용하지 않음**.
- 앱에 포함되는 npm 패키지의 라이선스 분포는 `THIRD_PARTY_NOTICES.md`의 표 참고. 대부분 MIT, 그 외 ISC / BSD-2 / BSD-3 / Apache-2.0 / 0BSD / BlueOak-1.0.0 / Unlicense / CC0 / CC-BY-4.0 / Python-2.0.
- 허용 목록 밖으로 분류된 항목: `lightningcss`(+플랫폼별 바이너리) **MPL-2.0** — 아래 3번.
- GPL/AGPL/LGPL 단독 라이선스 패키지: 없음. `(BSD-3-Clause OR GPL-2.0)` 이중 라이선스 1건은 BSD-3-Clause를 선택한다.

## 2. 주요 구성요소

| 구성요소 | 라이선스/약관 | 의무·메모 |
|---|---|---|
| Expo SDK, expo-* 모듈 | MIT | 저작권·라이선스 고지 |
| React, React Native | MIT | 고지 |
| react-native-vision-camera, -worklets | MIT (Margelo) | 고지 |
| react-native-nitro-modules, -nitro-image, nitrogen | MIT (Margelo) | 고지. nitrogen이 생성한 코드는 이 저장소에 포함됨 |
| react-native-worklets, react-native-reanimated | MIT (Software Mansion) | 고지 |
| react-native-svg, react-native-screens, react-native-safe-area-context | MIT | 고지 |
| Hermes | MIT | 고지 |
| AndroidX (CameraX 포함) | Apache-2.0 | 고지, NOTICE 유지 |
| Kotlin 표준 라이브러리 | Apache-2.0 | 고지 |
| **Google ML Kit** (face-detection 16.1.7, object-detection 17.0.2 / iOS GoogleMLKit 9.0.0) | **오픈소스가 아님.** ML Kit Terms of Service + Google APIs Terms of Service | 리버스 엔지니어링 금지. 사용자에게 ML Kit 지표 처리 고지 의무(PRIVACY.md). 번들 모델은 "related software"로 약관 적용 |
| Google Play services 기반 전이 의존성(play-services-base/tasks 등), Firebase 구성요소(ML Kit 진단용) | Android Software Development Kit License / 각 약관 | Gradle 전이 의존성. 최종 목록은 `./gradlew :app:dependencies`로 출시 전 재확인 (**미완료**) |

## 3. 검토 필요 항목

| 항목 | 라이선스 | 판단 |
|---|---|---|
| lightningcss 및 플랫폼별 바이너리 12개 | MPL-2.0 | Expo CLI/Metro의 **빌드 도구**(CSS 처리)로, `dependencies` 트리에 있지만 앱 바이너리에 포함되지 않는다. 소스를 수정·재배포하지 않으므로 추가 의무 없음. 수정해 배포할 경우 해당 파일 소스 공개 의무 |
| `(BSD-3-Clause OR GPL-2.0)` 1건 | 이중 | BSD-3-Clause 선택 |

## 4. 자체 제작/제공 자산

| 자산 | 출처 | 메모 |
|---|---|---|
| 앱 아이콘, 로고, 스플래시 | 자체 제작 (`scripts/generate-brand-assets.py`, PIL로 직접 그림) | 타사 로고 모방 없음 |
| UI 아이콘 (`Icon.tsx`) | 자체 제작 SVG 경로 | 아이콘 폰트 미사용 |
| 구도 도식 | 자체 제작 SVG (`CompositionDiagram.tsx`) | |
| 샘플 사진 22장(번들) | 사용자가 제공한 AI 생성 이미지 | `IMAGE_ASSET_ATTRIBUTIONS.md` |
| 폰트 | 시스템 폰트 | 번들 폰트 없음 |

## 5. 이 저장소의 라이선스

루트 `LICENSE`는 템플릿이 만든 MIT 파일이다. **공개 저장소의 라이선스를 MIT로 둘지는 소유자가 결정**한다(RELEASE_CHECKLIST).

## 6. 갱신 절차

1. 패키지 추가/업데이트 후 `npm run licenses` 실행
2. 출력의 "검토 필요" 항목 확인 → 이 문서 3번 갱신
3. 네이티브 SDK 버전이 바뀌면 2번 표와 `TECH_RESEARCH.md` 갱신

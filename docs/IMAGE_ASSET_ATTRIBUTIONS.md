# IMAGE_ASSET_ATTRIBUTIONS — 이미지 자산 출처

- 기록일: 2026-11-11

## 샘플 사진 (`assets/samples/`)

| 항목 | 내용 |
|---|---|
| 출처 | 프로젝트 소유자가 제공한 `GudoPick_Sample_Assets_44.zip` |
| 생성 도구 | OpenAI 이미지 생성 기능 (zip 내 README 기재). 제3자 사진을 수집한 것이 아님 |
| 생성일 | zip에 기재 없음 — **소유자 확인 필요** |
| 형식 | 300×300 JPEG 44장 (콜라주 3장에서 분리). 원본 콜라주(`source_sheets/`)는 저장소에 넣지 않음 |
| 설명 | `assets/samples/manifest.json` (카테고리, 구도 설명, 권장 용도) |
| 수정 내역 | 없음 (그대로 복사) |
| 이용 조건 | 사용 시점의 OpenAI 이용 약관과 관련 법령을 따른다. **스토어 출시 전 소유자가 재확인** |

주의 (zip README 기준)

- UI 예시용이다. 카메라 감지/구도 알고리즘의 정답 데이터로 쓰지 않는다 → 테스트에서도 사용하지 않았다.
- 이미지 속 인물·장소·제품은 AI 생성물이며 실제가 아니다. 앱의 오픈소스 라이선스 화면에 이 사실을 표시한다.
- 300px 저해상도라 스플래시 전체 배경에서는 흐릿하게 보인다(약한 블러 처리). 출시 전 고해상도 이미지로 교체 권장.

## 앱에서 실제로 쓰는 이미지 (22장, `src/shared/sample-images.ts`)

| 키 | 파일 | 사용처 |
|---|---|---|
| portrait_back_view_sunset | portrait/portrait_back_view_sunset.jpg | 스플래시 배경, 온보딩 "여백 있는" |
| portrait_seaside_profile | portrait/portrait_seaside_profile.jpg | 온보딩 "인물", 프리셋 표지 |
| food_cafe_brunch_overhead | food-cafe/food_cafe_brunch_overhead.jpg | 온보딩 "음식·카페", 표지 |
| landscape_lighthouse_coast | landscape/landscape_lighthouse_coast.jpg | 온보딩 "여행·풍경", 표지 |
| ootd_back_view_minimal | ootd/ootd_back_view_minimal.jpg | 온보딩 "OOTD", 표지 |
| landscape_sunset_horizon | landscape/landscape_sunset_horizon.jpg | 온보딩 "중앙 집중", 예시 프리셋 "일몰 감성" |
| landscape_sunset_rocky_coast | landscape/landscape_sunset_rocky_coast.jpg | 온보딩 "3분할" |
| food_pasta_closeup | food-cafe/food_pasta_closeup.jpg | 온보딩 "클로즈업" |
| cafe_window_table | food-cafe/cafe_window_table.jpg | 예시 프리셋 "카페 감성" |
| portrait_seaside_closeup | portrait/portrait_seaside_closeup.jpg | 예시 프리셋 "인물 중심" |
| travel_seoul_skyline_dusk | travel/travel_seoul_skyline_dusk.jpg | 예시 프리셋 "여행 풍경" |
| 그 외 11장 | (sample-images.ts 참고) | 프리셋 표지 선택지 |

나머지 22장은 저장소에는 있지만 코드에서 참조하지 않아 앱 번들에 포함되지 않는다.

## 자체 제작

| 자산 | 제작 방법 |
|---|---|
| `assets/brand/*.png` (아이콘, 스플래시, 로고) | `scripts/generate-brand-assets.py` — PIL로 도형을 직접 그림. 외부 이미지·폰트 미사용 |
| UI 아이콘 | `src/design-system/components/Icon.tsx` — 직접 작성한 SVG 경로 |
| 구도 도식 | `src/features/onboarding/CompositionDiagram.tsx` — 프로필 값으로 그리는 SVG |

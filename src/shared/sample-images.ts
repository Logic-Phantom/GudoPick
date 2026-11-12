import type { ImageSourcePropType } from 'react-native';

/**
 * 번들된 샘플 이미지 (AI 생성, 300×300 JPEG).
 * 출처/사용 범위: docs/IMAGE_ASSET_ATTRIBUTIONS.md
 *
 * UI 예시용이며 실제 장소·인물·제품이 아니다. 카메라 감지/구도 알고리즘의 정답 데이터로 쓰지 않는다.
 */
export const SAMPLE_IMAGES = {
  portrait_seaside_profile: require('@/assets/samples/portrait/portrait_seaside_profile.jpg'),
  portrait_seaside_closeup: require('@/assets/samples/portrait/portrait_seaside_closeup.jpg'),
  portrait_back_view_sunset: require('@/assets/samples/portrait/portrait_back_view_sunset.jpg'),
  portrait_backlit_city: require('@/assets/samples/portrait/portrait_backlit_city.jpg'),
  portrait_city_ocean_profile: require('@/assets/samples/portrait/portrait_city_ocean_profile.jpg'),
  food_cafe_brunch_overhead: require('@/assets/samples/food-cafe/food_cafe_brunch_overhead.jpg'),
  food_pasta_closeup: require('@/assets/samples/food-cafe/food_pasta_closeup.jpg'),
  food_croissant_latte_45: require('@/assets/samples/food-cafe/food_croissant_latte_45.jpg'),
  food_iced_coffee_minimal: require('@/assets/samples/food-cafe/food_iced_coffee_minimal.jpg'),
  cafe_window_table: require('@/assets/samples/food-cafe/cafe_window_table.jpg'),
  landscape_sunset_horizon: require('@/assets/samples/landscape/landscape_sunset_horizon.jpg'),
  landscape_sunset_rocky_coast: require('@/assets/samples/landscape/landscape_sunset_rocky_coast.jpg'),
  landscape_lighthouse_coast: require('@/assets/samples/landscape/landscape_lighthouse_coast.jpg'),
  landscape_beach_horizon: require('@/assets/samples/landscape/landscape_beach_horizon.jpg'),
  travel_seoul_skyline_dusk: require('@/assets/samples/travel/travel_seoul_skyline_dusk.jpg'),
  travel_namsan_pastel: require('@/assets/samples/travel/travel_namsan_pastel.jpg'),
  city_night_bridge: require('@/assets/samples/city-night/city_night_bridge.jpg'),
  architecture_negative_space: require('@/assets/samples/architecture/architecture_negative_space.jpg'),
  ootd_back_view_minimal: require('@/assets/samples/ootd/ootd_back_view_minimal.jpg'),
  botanical_daisy_negative_space: require('@/assets/samples/botanical/botanical_daisy_negative_space.jpg'),
  pet_dog_centered: require('@/assets/samples/pets/pet_dog_centered.jpg'),
  product_earbuds_minimal: require('@/assets/samples/objects/product_earbuds_minimal.jpg'),
} as const satisfies Record<string, ImageSourcePropType>;

export type SampleImageKey = keyof typeof SAMPLE_IMAGES;

export const DEFAULT_COVER_KEY: SampleImageKey = 'landscape_sunset_horizon';

export function sampleImage(key: string): ImageSourcePropType {
  return (SAMPLE_IMAGES as Record<string, ImageSourcePropType>)[key] ?? SAMPLE_IMAGES[DEFAULT_COVER_KEY];
}

/** 프리셋 표지로 고를 수 있는 이미지 목록 */
export const COVER_CHOICES: readonly SampleImageKey[] = [
  'landscape_sunset_horizon',
  'cafe_window_table',
  'portrait_seaside_closeup',
  'travel_seoul_skyline_dusk',
  'portrait_seaside_profile',
  'food_cafe_brunch_overhead',
  'landscape_lighthouse_coast',
  'ootd_back_view_minimal',
  'food_croissant_latte_45',
  'city_night_bridge',
  'architecture_negative_space',
  'botanical_daisy_negative_space',
  'pet_dog_centered',
  'product_earbuds_minimal',
  'travel_namsan_pastel',
  'landscape_beach_horizon',
];

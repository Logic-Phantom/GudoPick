import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { rollFromGravity } from '@/domain/composition/level';

/**
 * 가속도 센서로 기기의 좌우 기울기(roll)를 읽는다.
 *
 * - 값은 ref로 제공한다(초당 10회 갱신 때문에 리렌더하지 않기 위해).
 * - 센서가 없으면 `available=false` → 수평 안내를 표시하지 않는다.
 * - 축 부호는 플랫폼마다 반대다(iOS는 중력 방향, Android는 반작용 방향).
 *   ⚠️ 부호(기울기 선이 도는 방향)는 실기기 확인 대상이다. 크기에는 영향이 없다.
 */
export function useLevelSensor(enabled: boolean) {
  const rollRef = useRef<number | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!enabled) {
      rollRef.current = null;
      return;
    }
    let cancelled = false;
    let subscription: { remove(): void } | null = null;
    const xSign: 1 | -1 = Platform.OS === 'ios' ? 1 : -1;

    (async () => {
      try {
        const isAvailable = await Accelerometer.isAvailableAsync();
        if (cancelled) return;
        setAvailable(isAvailable);
        if (!isAvailable) return;
        Accelerometer.setUpdateInterval(100);
        subscription = Accelerometer.addListener((reading) => {
          rollRef.current = rollFromGravity(reading, xSign);
        });
      } catch {
        if (!cancelled) setAvailable(false);
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      rollRef.current = null;
    };
  }, [enabled]);

  return { rollRef, available };
}

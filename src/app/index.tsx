import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Animated, Easing, Image, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/design-system/components';
import { colors, radius, spacing, typography } from '@/design-system/tokens';
import { useAppData } from '@/features/app-data/AppDataProvider';
import { SAMPLE_IMAGES } from '@/shared/sample-images';

const MIN_SPLASH_MS = 1400;

/** 스플래시 / 첫 실행 화면. 로컬 데이터가 준비되면 온보딩 또는 홈으로 이동한다. */
export default function LaunchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, settings, errorMessage, retry } = useAppData();
  const [progress] = useState(() => new Animated.Value(0));
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: MIN_SPLASH_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    const timer = setTimeout(() => setMinTimePassed(true), MIN_SPLASH_MS);
    return () => {
      animation.stop();
      clearTimeout(timer);
    };
  }, [progress]);

  useEffect(() => {
    if (state !== 'ready' || !minTimePassed) return;
    router.replace(settings.onboardingCompleted ? '/home' : '/onboarding');
  }, [state, minTimePassed, settings.onboardingCompleted, router]);

  return (
    <ImageBackground
      source={SAMPLE_IMAGES.portrait_back_view_sunset}
      resizeMode="cover"
      blurRadius={1}
      style={styles.background}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['rgba(20,24,40,0.55)', 'rgba(20,24,40,0.15)', 'rgba(0,0,0,0.45)']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.brand, { marginTop: insets.top + 96 }]}>
        <Image
          source={require('@/assets/brand/logo-on-dark.png')}
          style={styles.logo}
          accessibilityIgnoresInvertColors
        />
        <Text style={styles.name} accessibilityRole="header">
          구도픽
        </Text>
        <Text style={styles.nameEn}>GudoPick</Text>
        <Text style={styles.tagline}>{'내 취향을 켜는,\n완벽한 구도'}</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 28 }]}>
        {state === 'error' ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              앱 데이터를 불러오지 못했어요.{errorMessage ? `\n(${errorMessage})` : ''}
            </Text>
            <PrimaryButton label="다시 시도" onPress={retry} showArrow={false} />
          </View>
        ) : (
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityLabel="앱을 준비하고 있어요">
            <Animated.View
              style={[
                styles.bar,
                { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['12%', '100%'] }) },
              ]}
            />
          </View>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: '#2B3350' },
  brand: { alignItems: 'center' },
  logo: { width: 92, height: 92 },
  name: { ...typography.display, fontSize: 44, lineHeight: 54, color: colors.onDark, marginTop: spacing.md },
  nameEn: { ...typography.bodyStrong, fontSize: 16, color: colors.onDark, marginTop: 2, letterSpacing: 0.4 },
  tagline: {
    ...typography.body,
    color: colors.onDark,
    textAlign: 'center',
    marginTop: spacing.xxl,
    opacity: 0.92,
  },
  footer: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: spacing.screen },
  track: {
    width: 84,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.35)',
    overflow: 'hidden',
  },
  bar: { height: 4, borderRadius: radius.pill, backgroundColor: colors.onDark },
  errorBox: { alignSelf: 'stretch', gap: spacing.lg },
  errorText: { ...typography.body, color: colors.onDark, textAlign: 'center' },
});

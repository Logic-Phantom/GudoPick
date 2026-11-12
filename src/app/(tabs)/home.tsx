import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon, IconButton, PrimaryButton, Screen } from '@/design-system/components';
import { colors, radius, shadows, spacing, typography } from '@/design-system/tokens';
import { useAppData } from '@/features/app-data/AppDataProvider';
import { MODE_OPTIONS } from '@/features/preferences/options';
import { sampleImage } from '@/shared/sample-images';

export default function HomeScreen() {
  const router = useRouter();
  const { activePreset } = useAppData();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.brand}>구도픽</Text>
          <IconButton icon="settings" label="설정" onPress={() => router.replace('/settings')} />
        </View>

        <Text style={styles.title} accessibilityRole="header">
          {'내 취향으로\n촬영하기'}
        </Text>
        <Text style={styles.subtitle}>지금, 가장 좋은 구도로</Text>

        <PrimaryButton
          label="카메라 시작하기"
          leftIcon="camera"
          spread
          onPress={() => router.push('/camera')}
          accessibilityHint={activePreset ? `${activePreset.name} 프리셋으로 카메라를 엽니다` : undefined}
          style={styles.cta}
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            내 프리셋
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="프리셋 더보기"
            onPress={() => router.replace('/presets')}
            hitSlop={10}
            style={styles.more}>
            <Text style={styles.moreLabel}>더보기</Text>
            <Icon name="chevronRight" size={14} color={colors.text} />
          </Pressable>
        </View>

        {activePreset ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${activePreset.name} 프리셋으로 촬영하기`}
            onPress={() => router.push('/camera')}
            style={({ pressed }) => [styles.presetCard, pressed && styles.pressed]}>
            <Image
              source={sampleImage(activePreset.coverKey)}
              style={styles.presetImage}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.6)']}
              style={styles.presetShade}
              pointerEvents="none"
            />
            <Text style={styles.presetName} numberOfLines={1}>
              {activePreset.name}
            </Text>
            <IconButton
              icon="pencil"
              label={`${activePreset.name} 프리셋 수정`}
              color={colors.onDark}
              size={20}
              onPress={() => router.push({ pathname: '/preset-edit', params: { id: activePreset.id } })}
              style={styles.presetEdit}
            />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="프리셋 추가하기"
            onPress={() => router.push('/preset-edit')}
            style={styles.emptyCard}>
            <Icon name="plus" color={colors.textSecondary} />
            <Text style={styles.emptyLabel}>프리셋 추가하기</Text>
          </Pressable>
        )}

        <Text style={[styles.sectionTitle, styles.quickTitle]} accessibilityRole="header">
          빠른 모드
        </Text>
        <View style={styles.quickRow}>
          {MODE_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={`${option.label} 모드로 촬영하기`}
              accessibilityHint={option.note}
              onPress={() => router.push({ pathname: '/camera', params: { mode: option.value } })}
              style={({ pressed }) => [styles.quickChip, pressed && styles.pressed]}>
              <Text style={styles.quickLabel}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: -spacing.sm,
  },
  brand: { ...typography.heading, fontSize: 19, color: colors.text },
  title: { ...typography.display, color: colors.text, marginTop: spacing.xxl },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
  cta: { marginTop: spacing.xxxl },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 44,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.heading, color: colors.text },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  moreLabel: { ...typography.caption, color: colors.text },
  presetCard: {
    height: 128,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    ...shadows.card,
  },
  presetImage: { width: '100%', height: '100%' },
  presetShade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '40%' },
  presetName: {
    ...typography.bodyStrong,
    color: colors.onDark,
    position: 'absolute',
    left: spacing.lg,
    bottom: spacing.md,
    right: 56,
  },
  presetEdit: { position: 'absolute', right: spacing.xs, bottom: 0 },
  emptyCard: {
    height: 96,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  emptyLabel: { ...typography.label, color: colors.textSecondary },
  quickTitle: { marginTop: spacing.xxxl, marginBottom: spacing.md },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickChip: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { ...typography.label, color: colors.text },
  pressed: { opacity: 0.8 },
});

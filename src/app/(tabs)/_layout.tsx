import { Redirect, Slot, usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/design-system/components';
import { colors, spacing, typography } from '@/design-system/tokens';
import { useAppData } from '@/features/app-data/AppDataProvider';

const TABS: readonly { href: '/home' | '/presets' | '/settings'; label: string; icon: IconName }[] = [
  { href: '/home', label: '홈', icon: 'home' },
  { href: '/presets', label: '프리셋', icon: 'layers' },
  { href: '/settings', label: '설정', icon: 'settings' },
];

/** 홈 / 프리셋 / 설정 하단 내비게이션 (목업의 3탭) */
export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { state, settings } = useAppData();

  if (state !== 'ready') return <Redirect href="/" />;
  if (!settings.onboardingCompleted) return <Redirect href="/onboarding" />;

  return (
    <View style={styles.root}>
      <View style={styles.content}>
        <Slot />
      </View>
      <View
        style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
        accessibilityRole="tablist">
        {TABS.map((tab) => {
          const selected = pathname === tab.href;
          // 목업: 홈은 라임, 그 외 탭은 검정으로 활성 표시
          const activeColor = tab.href === '/home' ? colors.accentStrong : colors.text;
          const tint = selected ? activeColor : colors.textTertiary;
          return (
            <Pressable
              key={tab.href}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected }}
              onPress={() => {
                if (!selected) router.replace(tab.href);
              }}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
              <Icon name={tab.icon} color={tint} size={24} strokeWidth={selected ? 2.2 : 1.8} />
              <Text style={[styles.label, { color: selected ? colors.text : colors.textTertiary }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: { minWidth: 72, minHeight: 48, alignItems: 'center', justifyContent: 'center', gap: 4 },
  label: { ...typography.caption, fontSize: 11 },
  pressed: { opacity: 0.6 },
});

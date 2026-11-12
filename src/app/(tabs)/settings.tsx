import { useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HeaderBar, ListRow, Screen } from '@/design-system/components';
import { colors, radius, spacing, typography } from '@/design-system/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const open = (section: string) => router.push({ pathname: '/settings/[section]', params: { section } });

  return (
    <Screen>
      <HeaderBar title="설정" onBack={() => router.replace('/home')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.group}>
          <ListRow icon="info" label="촬영 가이드 설정" onPress={() => open('guide')} />
          <ListRow icon="vibrate" label="진동 알림" onPress={() => open('haptics')} />
          <ListRow icon="message" label="알림 문구 설정" onPress={() => open('messages')} />
        </View>
        <View style={styles.group}>
          <ListRow icon="shield" label="개인정보 처리방침" onPress={() => open('privacy')} />
          <ListRow icon="code" label="오픈소스 라이선스" onPress={() => open('licenses')} />
          <ListRow icon="info" label="앱 정보" onPress={() => open('about')} />
        </View>

        <View style={styles.brandCard} accessible accessibilityLabel="구도픽. 내 취향대로, 구도 ON!">
          <Image
            source={require('@/assets/brand/logo-on-light.png')}
            style={styles.brandLogo}
            accessibilityIgnoresInvertColors
          />
          <View>
            <Text style={styles.brandName}>구도픽</Text>
            <Text style={styles.brandTagline}>내 취향대로, 구도 ON!</Text>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl },
  group: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingVertical: spacing.sm,
  },
  brandCard: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  brandLogo: { width: 44, height: 44 },
  brandName: { ...typography.label, color: colors.text },
  brandTagline: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});

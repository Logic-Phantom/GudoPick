import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HeaderBar, Icon, IconButton, Screen, TextButton } from '@/design-system/components';
import { colors, radius, shadows, spacing, typography } from '@/design-system/tokens';
import type { Preset } from '@/domain/preferences/preset';
import { useAppData } from '@/features/app-data/AppDataProvider';
import { modeLabel } from '@/features/preferences/options';
import { sampleImage } from '@/shared/sample-images';

export default function PresetsScreen() {
  const router = useRouter();
  const { presets, selectPreset, duplicatePreset, deletePreset } = useAppData();
  const [editing, setEditing] = useState(false);

  const confirmDelete = (preset: Preset) => {
    Alert.alert('프리셋 삭제', `'${preset.name}' 프리셋을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => void deletePreset(preset.id) },
    ]);
  };

  return (
    <Screen>
      <HeaderBar
        title="내 프리셋"
        onBack={() => router.replace('/home')}
        right={
          presets.length > 0 ? (
            <TextButton
              label={editing ? '완료' : '편집'}
              color={colors.text}
              onPress={() => setEditing(!editing)}
              style={styles.editButton}
            />
          ) : null
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>상황에 맞는 구도를 빠르게!</Text>

        <View accessibilityRole="radiogroup" style={styles.list}>
          {presets.map((preset) => {
            const selected = preset.isDefault;
            return (
              <Pressable
                key={preset.id}
                accessibilityRole="radio"
                accessibilityLabel={`${preset.name}, ${modeLabel(preset.answers.mode)}, ${preset.answers.aspectRatio}`}
                accessibilityHint={selected ? '현재 기본 프리셋' : '눌러서 기본 프리셋으로 지정'}
                accessibilityState={{ selected }}
                onPress={() => void selectPreset(preset.id)}
                style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}>
                <Image
                  source={sampleImage(preset.coverKey)}
                  style={styles.thumb}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
                <View style={styles.rowText}>
                  <Text style={styles.name} numberOfLines={1}>
                    {preset.name}
                  </Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {modeLabel(preset.answers.mode)} · {preset.answers.aspectRatio}
                  </Text>
                </View>
                {editing ? (
                  <View style={styles.actions}>
                    <IconButton
                      icon="pencil"
                      label={`${preset.name} 수정`}
                      size={20}
                      onPress={() => router.push({ pathname: '/preset-edit', params: { id: preset.id } })}
                    />
                    <IconButton
                      icon="copy"
                      label={`${preset.name} 복제`}
                      size={20}
                      onPress={() => void duplicatePreset(preset.id)}
                    />
                    <IconButton
                      icon="trash"
                      label={`${preset.name} 삭제`}
                      size={20}
                      color={colors.danger}
                      onPress={() => confirmDelete(preset)}
                    />
                  </View>
                ) : selected ? (
                  <View style={styles.check}>
                    <Icon name="checkCircle" color={colors.accent} size={28} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {presets.length === 0 ? (
          <Text style={styles.empty}>아직 프리셋이 없어요. 아래 버튼으로 추가해 보세요.</Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="프리셋 추가하기"
          onPress={() => router.push('/preset-edit')}
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}>
          <Icon name="plus" size={18} />
          <Text style={styles.addLabel}>프리셋 추가하기</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxxl },
  editButton: { paddingHorizontal: spacing.sm },
  subtitle: { ...typography.body, fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.xl },
  list: { gap: spacing.md },
  row: {
    height: 76,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
    ...shadows.card,
  },
  rowSelected: { borderColor: colors.accent, backgroundColor: colors.surface },
  thumb: { width: 76, height: 76 },
  rowText: { flex: 1, paddingHorizontal: spacing.xl },
  name: { ...typography.body, color: colors.text },
  meta: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  check: { marginRight: spacing.lg },
  actions: { flexDirection: 'row', marginRight: spacing.xs },
  empty: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginVertical: spacing.xxl },
  add: {
    marginTop: spacing.lg,
    height: 56,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...shadows.card,
  },
  addLabel: { ...typography.label, color: colors.text },
  pressed: { opacity: 0.8 },
});

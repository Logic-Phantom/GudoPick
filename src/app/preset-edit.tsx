import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  HeaderBar,
  PrimaryButton,
  Screen,
  SegmentedChips,
  TextButton,
  ToggleRow,
} from '@/design-system/components';
import { colors, radius, spacing, typography } from '@/design-system/tokens';
import { coverKeyForMode } from '@/domain/preferences/preset';
import {
  createProfileFromAnswers,
  DEFAULT_ANSWERS,
  type PreferenceAnswers,
} from '@/domain/preferences/profile-factory';
import { useAppData } from '@/features/app-data/AppDataProvider';
import { CompositionDiagram } from '@/features/onboarding/CompositionDiagram';
import {
  INTENSITY_OPTIONS,
  MODE_OPTIONS,
  PLACEMENT_OPTIONS,
  RATIO_OPTIONS,
  SIZE_OPTIONS,
  STYLE_OPTIONS,
} from '@/features/preferences/options';
import { PRESET_NAME_MAX_LENGTH } from '@/infrastructure/database/presets-repository';
import { COVER_CHOICES, sampleImage } from '@/shared/sample-images';

/** 프리셋 생성/수정 화면. `id`가 있으면 수정, 없으면 새로 만든다. */
export default function PresetEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { presets, createPreset, updatePreset, deletePreset, duplicatePreset, selectPreset } = useAppData();
  const existing = useMemo(() => presets.find((preset) => preset.id === id) ?? null, [presets, id]);

  const [name, setName] = useState(existing?.name ?? '');
  const [answers, setAnswers] = useState<PreferenceAnswers>(existing?.answers ?? DEFAULT_ANSWERS);
  const [coverKey, setCoverKey] = useState<string>(existing?.coverKey ?? coverKeyForMode(DEFAULT_ANSWERS.mode));
  const [coverTouched, setCoverTouched] = useState(existing !== null);
  const [busy, setBusy] = useState(false);

  const patch = (next: Partial<PreferenceAnswers>) => {
    setAnswers((previous) => ({ ...previous, ...next }));
    // 새 프리셋에서 표지를 직접 고르지 않았다면 촬영 대상에 맞는 표지를 따라간다.
    if (next.mode && !coverTouched) setCoverKey(coverKeyForMode(next.mode));
  };

  const profile = useMemo(
    () => createProfileFromAnswers(answers, { id: existing?.id ?? 'draft', name: name || '새 프리셋' }),
    [answers, existing?.id, name],
  );
  const modeNote = MODE_OPTIONS.find((option) => option.value === answers.mode)?.note;
  const usesSubject = answers.mode !== 'landscape';
  const trimmedName = name.trim();

  const save = async () => {
    if (busy || trimmedName.length === 0) return;
    setBusy(true);
    try {
      const input = { name: trimmedName, answers, coverKey };
      if (existing) await updatePreset(existing.id, input);
      else await createPreset(input);
      router.back();
    } catch (error) {
      Alert.alert('저장하지 못했어요', error instanceof Error ? error.message : '다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert('프리셋 삭제', `'${existing.name}' 프리셋을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deletePreset(existing.id);
            router.back();
          })();
        },
      },
    ]);
  };

  return (
    <Screen>
      <HeaderBar title={existing ? '프리셋 수정' : '프리셋 추가'} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>이름</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="예: 카페 감성"
          placeholderTextColor={colors.textTertiary}
          maxLength={PRESET_NAME_MAX_LENGTH}
          style={styles.input}
          accessibilityLabel="프리셋 이름"
          returnKeyType="done"
        />

        <Text style={styles.label}>표지</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.covers}>
          {COVER_CHOICES.map((key) => {
            const selected = key === coverKey;
            return (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityLabel="표지 이미지"
                accessibilityState={{ selected }}
                onPress={() => {
                  setCoverKey(key);
                  setCoverTouched(true);
                }}
                style={[styles.cover, selected && styles.coverSelected]}>
                <Image source={sampleImage(key)} style={styles.coverImage} accessibilityIgnoresInvertColors />
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.preview}>
          <CompositionDiagram size={120} profile={profile} />
          <View style={styles.previewText}>
            <Text style={styles.previewTitle}>가이드 미리보기</Text>
            <Text style={styles.previewNote}>{modeNote}</Text>
          </View>
        </View>

        <Text style={styles.label}>촬영 대상</Text>
        <SegmentedChips
          accessibilityLabel="촬영 대상"
          options={MODE_OPTIONS}
          value={answers.mode}
          onChange={(mode) => patch({ mode })}
        />

        <Text style={styles.label}>구도</Text>
        <SegmentedChips
          accessibilityLabel="구도"
          options={STYLE_OPTIONS}
          value={answers.style}
          onChange={(style) => patch({ style })}
        />

        {usesSubject ? (
          <>
            <Text style={styles.label}>피사체 위치</Text>
            <SegmentedChips
              accessibilityLabel="피사체 위치"
              options={PLACEMENT_OPTIONS}
              value={answers.placement}
              onChange={(placement) => patch({ placement })}
            />
            <Text style={styles.label}>피사체 크기</Text>
            <SegmentedChips
              accessibilityLabel="피사체 크기"
              options={SIZE_OPTIONS}
              value={answers.size}
              onChange={(size) => patch({ size })}
            />
          </>
        ) : null}

        <Text style={styles.label}>사진 비율 프레임</Text>
        <SegmentedChips
          accessibilityLabel="사진 비율 프레임"
          options={RATIO_OPTIONS}
          value={answers.aspectRatio}
          onChange={(aspectRatio) => patch({ aspectRatio })}
        />

        <Text style={styles.label}>가이드 강도</Text>
        <SegmentedChips
          accessibilityLabel="가이드 강도"
          options={INTENSITY_OPTIONS}
          value={answers.guidanceIntensity}
          onChange={(guidanceIntensity) => patch({ guidanceIntensity })}
        />

        <View style={styles.toggle}>
          <ToggleRow
            icon="level"
            label="수평 안내"
            description="기기 기울기 센서로 수평선을 보여줘요"
            value={answers.levelGuide}
            onValueChange={(levelGuide) => patch({ levelGuide })}
          />
        </View>

        {existing ? (
          <View style={styles.extra}>
            {!existing.isDefault ? (
              <TextButton
                label="기본 프리셋으로 지정"
                color={colors.text}
                onPress={() => void selectPreset(existing.id)}
              />
            ) : (
              <Text style={styles.defaultNote}>현재 기본 프리셋이에요</Text>
            )}
            <TextButton
              label="복제"
              color={colors.text}
              onPress={() => {
                void duplicatePreset(existing.id);
                router.back();
              }}
            />
            <TextButton label="삭제" color={colors.danger} onPress={confirmDelete} />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <PrimaryButton
          label={existing ? '저장' : '프리셋 만들기'}
          showArrow={false}
          disabled={busy || trimmedName.length === 0}
          onPress={() => void save()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xxl },
  label: { ...typography.label, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  input: {
    ...typography.body,
    color: colors.text,
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.lg,
  },
  covers: { gap: spacing.sm, paddingRight: spacing.screen },
  cover: { borderRadius: radius.lg, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  coverSelected: { borderColor: colors.accent },
  coverImage: { width: 64, height: 64 },
  preview: {
    marginTop: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.xl,
    padding: spacing.md,
  },
  previewText: { flex: 1 },
  previewTitle: { ...typography.label, color: colors.text },
  previewNote: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  toggle: { marginTop: spacing.lg },
  extra: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  defaultNote: { ...typography.caption, color: colors.accentStrong, paddingHorizontal: spacing.lg },
  footer: { paddingHorizontal: spacing.screen, paddingTop: spacing.md, backgroundColor: colors.background },
});

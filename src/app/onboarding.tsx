import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, Screen, SegmentedChips, TextButton, ToggleRow } from '@/design-system/components';
import { colors, spacing, typography } from '@/design-system/tokens';
import { aspectRatioValue } from '@/domain/composition/geometry';
import {
  createProfileFromAnswers,
  DEFAULT_ANSWERS,
  suggestedPlacementAndSize,
  type PreferenceAnswers,
} from '@/domain/preferences/profile-factory';
import { useAppData } from '@/features/app-data/AppDataProvider';
import { CompositionDiagram } from '@/features/onboarding/CompositionDiagram';
import { OptionCard } from '@/features/onboarding/OptionCards';
import {
  INTENSITY_OPTIONS,
  MODE_OPTIONS,
  PLACEMENT_OPTIONS,
  RATIO_OPTIONS,
  SIZE_OPTIONS,
  STYLE_OPTIONS,
} from '@/features/preferences/options';
import { SAMPLE_IMAGES } from '@/shared/sample-images';

const STEPS = [
  { title: '어떤 사진을\n좋아하시나요?', subtitle: '당신의 취향에 맞는\n구도를 찾아드려요' },
  { title: '어떤 구도를\n선호하시나요?', subtitle: '마음에 드는 구도를 선택해주세요' },
  { title: '피사체를\n어디에 둘까요?', subtitle: '위치와 크기를 골라주세요' },
  { title: '어떤 비율로\n찍으시나요?', subtitle: '카메라에 비율 프레임을 보여드려요' },
  { title: '가이드는 얼마나\n보여드릴까요?', subtitle: '언제든 설정에서 바꿀 수 있어요' },
] as const;

const GAP = 16;

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { completeOnboarding, settings, updateSettings } = useAppData();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<PreferenceAnswers>(DEFAULT_ANSWERS);
  const [tips, setTips] = useState(settings.shootingTipsEnabled);
  const [busy, setBusy] = useState(false);

  const cardWidth = Math.floor((width - spacing.screen * 2 - GAP) / 2);
  const smallCardWidth = Math.floor((width - spacing.screen * 2 - GAP * 2) / 3);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const patch = (next: Partial<PreferenceAnswers>) => setAnswers((previous) => ({ ...previous, ...next }));

  /** 현재 선택이 실제 가이드에 어떻게 반영되는지 보여주는 미리보기 프로필 */
  const previewProfile = useMemo(
    () => createProfileFromAnswers(answers, { id: 'preview', name: '미리보기' }),
    [answers],
  );

  const finish = async (useAnswers: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (useAnswers) await updateSettings({ shootingTipsEnabled: tips });
      await completeOnboarding(useAnswers ? answers : null);
      router.replace('/home');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl }]}
        showsVerticalScrollIndicator={false}>
        <View
          style={styles.progress}
          accessibilityRole="progressbar"
          accessibilityLabel={`${STEPS.length}단계 중 ${step + 1}단계`}>
          {STEPS.map((_, index) => (
            <View key={index} style={[styles.dot, index <= step && styles.dotActive]} />
          ))}
        </View>

        <Text style={styles.title} accessibilityRole="header">
          {current.title}
        </Text>
        <Text style={styles.subtitle}>{current.subtitle}</Text>

        {step === 0 ? (
          <View style={styles.grid} accessibilityRole="radiogroup">
            {MODE_OPTIONS.map((option) => (
              <OptionCard
                key={option.value}
                label={option.label}
                selected={answers.mode === option.value}
                onPress={() => patch({ mode: option.value })}
                width={cardWidth}
                imageHeight={Math.round(cardWidth * 0.86)}
                image={SAMPLE_IMAGES[option.image]}
              />
            ))}
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.grid} accessibilityRole="radiogroup">
            {STYLE_OPTIONS.map((option) => {
              const suggestion = suggestedPlacementAndSize(option.value);
              const profile = createProfileFromAnswers(
                { ...answers, style: option.value, ...suggestion, aspectRatio: '1:1', guidanceIntensity: 'normal' },
                { id: option.value, name: option.label },
              );
              const imageHeight = Math.round(cardWidth * 0.86);
              return (
                <OptionCard
                  key={option.value}
                  label={option.label}
                  selected={answers.style === option.value}
                  onPress={() => patch({ style: option.value, ...suggestion })}
                  width={cardWidth}
                  imageHeight={imageHeight}
                  image={SAMPLE_IMAGES[option.image]}
                  overlay={<CompositionDiagram size={imageHeight} profile={profile} tone="photo" />}
                />
              );
            })}
          </View>
        ) : null}

        {step === 2 ? (
          <>
            <View style={styles.grid} accessibilityRole="radiogroup">
              {PLACEMENT_OPTIONS.map((option) => {
                const profile = createProfileFromAnswers(
                  { ...answers, placement: option.value, aspectRatio: '1:1', guidanceIntensity: 'normal' },
                  { id: option.value, name: option.label },
                );
                return (
                  <OptionCard
                    key={option.value}
                    label={option.label}
                    selected={answers.placement === option.value}
                    onPress={() => patch({ placement: option.value })}
                    width={smallCardWidth}
                    imageHeight={smallCardWidth}>
                    <CompositionDiagram size={smallCardWidth} profile={profile} />
                  </OptionCard>
                );
              })}
            </View>
            <Text style={styles.groupLabel}>피사체 크기</Text>
            <SegmentedChips
              accessibilityLabel="피사체 크기"
              options={SIZE_OPTIONS}
              value={answers.size}
              onChange={(size) => patch({ size })}
            />
          </>
        ) : null}

        {step === 3 ? (
          <View style={styles.grid} accessibilityRole="radiogroup">
            {RATIO_OPTIONS.map((option) => (
              <OptionCard
                key={option.value}
                label={option.label}
                note={option.note}
                selected={answers.aspectRatio === option.value}
                onPress={() => patch({ aspectRatio: option.value })}
                width={cardWidth}
                imageHeight={Math.round(cardWidth * 0.8)}>
                <CompositionDiagram
                  size={Math.round(cardWidth * 0.8)}
                  aspect={aspectRatioValue(option.value)}
                  grid="thirds"
                  target={null}
                />
              </OptionCard>
            ))}
          </View>
        ) : null}

        {step === 4 ? (
          <>
            <View style={styles.grid} accessibilityRole="radiogroup">
              {INTENSITY_OPTIONS.map((option) => {
                const profile = createProfileFromAnswers(
                  { ...answers, guidanceIntensity: option.value },
                  { id: option.value, name: option.label },
                );
                return (
                  <OptionCard
                    key={option.value}
                    label={option.label}
                    note={option.note}
                    selected={answers.guidanceIntensity === option.value}
                    onPress={() => patch({ guidanceIntensity: option.value })}
                    width={smallCardWidth}
                    imageHeight={smallCardWidth}>
                    <CompositionDiagram size={smallCardWidth} profile={profile} />
                  </OptionCard>
                );
              })}
            </View>
            <View style={styles.toggles}>
              <ToggleRow
                icon="level"
                label="수평 안내"
                description="기기 기울기 센서로 수평선을 보여드려요"
                value={answers.levelGuide}
                onValueChange={(levelGuide) => patch({ levelGuide })}
              />
              <ToggleRow
                icon="message"
                label="촬영 도움말"
                description="카메라에서 짧은 사용 안내를 보여드려요"
                value={tips}
                onValueChange={setTips}
              />
            </View>
            <View style={styles.preview}>
              <CompositionDiagram size={132} profile={previewProfile} />
              <Text style={styles.previewText}>
                선택한 취향은 카메라의 목표 위치·크기·비율·격자에 그대로 반영돼요.
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <PrimaryButton
          label={isLast ? '시작하기' : '다음'}
          disabled={busy}
          onPress={() => (isLast ? finish(true) : setStep(step + 1))}
        />
        {step === 0 ? (
          <TextButton label="건너뛰기" onPress={() => finish(false)} />
        ) : (
          <TextButton label="이전" onPress={() => setStep(step - 1)} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.screen, paddingTop: spacing.xl },
  progress: { flexDirection: 'row', gap: 6, marginBottom: spacing.xxl },
  dot: { width: 18, height: 4, borderRadius: 2, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.ink },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  groupLabel: { ...typography.label, color: colors.text, marginTop: spacing.xxl, marginBottom: spacing.md },
  toggles: { marginTop: spacing.xl },
  preview: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 20,
    padding: spacing.md,
  },
  previewText: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  footer: { paddingHorizontal: spacing.screen, paddingTop: spacing.md, gap: spacing.xs, backgroundColor: colors.background },
});

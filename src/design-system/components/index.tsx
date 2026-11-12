import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, MIN_TOUCH, radius, shadows, spacing, typography } from '../tokens';
import { Icon, type IconName } from './Icon';

export { Icon, type IconName } from './Icon';

/** 밝은 화면 공통 컨테이너 (safe-area 반영) */
export function Screen({
  children,
  style,
  edges = ['top'],
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom')[];
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: edges.includes('top') ? insets.top : 0,
          paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

/** 검정 알약형 기본 버튼 (목업의 '다음 →', '카메라 시작하기 →') */
export function PrimaryButton({
  label,
  onPress,
  leftIcon,
  showArrow = true,
  disabled = false,
  spread = false,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  leftIcon?: IconName;
  showArrow?: boolean;
  disabled?: boolean;
  /** 아이콘-라벨-화살표를 양 끝으로 벌려 배치 (홈 CTA) */
  spread?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        spread && styles.primaryButtonSpread,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}>
      {leftIcon ? <Icon name={leftIcon} color={colors.onInk} size={22} /> : null}
      <Text style={[styles.primaryButtonLabel, spread && styles.primaryButtonLabelSpread]} numberOfLines={1}>
        {label}
      </Text>
      {showArrow ? <Icon name="arrowRight" color={colors.onInk} size={18} /> : null}
    </Pressable>
  );
}

/** 텍스트만 있는 보조 버튼 ('건너뛰기', '이전') */
export function TextButton({
  label,
  onPress,
  color = colors.textSecondary,
  style,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.textButton, pressed && styles.pressed, style]}>
      <Text style={[styles.textButtonLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** 아이콘만 있는 버튼. 접근성 라벨 필수 */
export function IconButton({
  icon,
  label,
  onPress,
  color = colors.text,
  size = 24,
  disabled = false,
  style,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, disabled && styles.disabled, pressed && styles.pressed, style]}>
      <Icon name={icon} color={color} size={size} />
    </Pressable>
  );
}

/** 뒤로가기 + 가운데 제목 헤더 (프리셋/설정 화면) */
export function HeaderBar({
  title,
  onBack,
  right,
  tone = 'light',
}: {
  title?: string;
  onBack?: () => void;
  right?: ReactNode;
  tone?: 'light' | 'dark';
}) {
  const color = tone === 'dark' ? colors.onDark : colors.text;
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {onBack ? <IconButton icon="chevronLeft" label="뒤로" onPress={onBack} color={color} /> : null}
      </View>
      <Text style={[styles.headerTitle, { color }]} numberOfLines={1} accessibilityRole="header">
        {title ?? ''}
      </Text>
      <View style={[styles.headerSide, styles.headerSideRight]}>{right}</View>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** 설정 목록 한 줄 */
export function ListRow({
  icon,
  label,
  description,
  onPress,
  right,
  showChevron = true,
  destructive = false,
}: {
  icon?: IconName;
  label: string;
  description?: string;
  onPress?: () => void;
  right?: ReactNode;
  showChevron?: boolean;
  destructive?: boolean;
}) {
  const tint = destructive ? colors.danger : colors.text;
  const content = (
    <>
      {icon ? <Icon name={icon} color={tint} size={22} /> : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: tint }]}>{label}</Text>
        {description ? <Text style={styles.rowDescription}>{description}</Text> : null}
      </View>
      {right}
      {onPress && showChevron ? <Icon name="chevronRight" color={colors.textTertiary} size={18} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={description}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      {content}
    </Pressable>
  );
}

export function ToggleRow({
  icon,
  label,
  description,
  value,
  onValueChange,
}: {
  icon?: IconName;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <ListRow
      icon={icon}
      label={label}
      description={description}
      right={
        <Switch
          accessibilityLabel={label}
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.borderStrong, true: colors.accent }}
          thumbColor={colors.surface}
        />
      }
    />
  );
}

/** 여러 선택지 중 하나를 고르는 칩 묶음 */
export function SegmentedChips<T extends string>({
  options,
  value,
  onChange,
  tone = 'light',
  accessibilityLabel,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  tone?: 'light' | 'dark';
  accessibilityLabel?: string;
}) {
  const dark = tone === 'dark';
  return (
    <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.chip,
              dark ? styles.chipDark : styles.chipLight,
              selected && (dark ? styles.chipDarkSelected : styles.chipLightSelected),
              pressed && styles.pressed,
            ]}>
            <Text
              style={[
                styles.chipLabel,
                { color: dark ? colors.onDark : colors.text },
                selected && { color: dark ? colors.ink : colors.onInk },
              ]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionTitle({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[styles.sectionTitle, style]} accessibilityRole="header">
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  primaryButton: {
    minHeight: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
    ...shadows.raised,
  },
  primaryButtonSpread: { justifyContent: 'space-between', minHeight: 68, paddingHorizontal: 28 },
  primaryButtonLabel: { ...typography.button, color: colors.onInk },
  primaryButtonLabelSpread: { flex: 1, marginLeft: spacing.md, fontSize: 16 },
  textButton: { minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  textButtonLabel: { ...typography.label },
  iconButton: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  headerSide: { width: 56, alignItems: 'flex-start', justifyContent: 'center' },
  headerSideRight: { alignItems: 'flex-end' },
  headerTitle: { ...typography.heading, flex: 1, textAlign: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    ...shadows.card,
  },
  row: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  rowPressed: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md },
  rowText: { flex: 1 },
  rowLabel: { ...typography.body, color: colors.text },
  rowDescription: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipLight: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
  chipLightSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipDark: { backgroundColor: colors.darkSurfaceRaised, borderColor: 'transparent' },
  chipDarkSelected: { backgroundColor: colors.onDark },
  chipLabel: { ...typography.label },
  sectionTitle: { ...typography.heading, color: colors.text },
});

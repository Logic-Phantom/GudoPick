import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { Icon } from '@/design-system/components';
import { colors, radius, shadows, spacing, typography } from '@/design-system/tokens';

/** 사진(또는 도식)이 위, 라벨이 아래에 오는 선택 카드 (목업의 온보딩 카드) */
export function OptionCard({
  label,
  note,
  selected,
  onPress,
  width,
  imageHeight,
  image,
  overlay,
  children,
}: {
  label: string;
  note?: string;
  selected: boolean;
  onPress: () => void;
  width: number;
  imageHeight: number;
  image?: ImageSourcePropType;
  /** 사진 위에 겹쳐 그리는 도식 */
  overlay?: ReactNode;
  /** 사진 대신 넣는 도식 */
  children?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={note ? `${label}, ${note}` : label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { width }, selected && styles.cardSelected, pressed && styles.pressed]}>
      <View style={[styles.media, { height: imageHeight }]}>
        {image ? (
          <Image source={image} style={styles.image} resizeMode="cover" accessibilityIgnoresInvertColors />
        ) : (
          <View style={styles.diagram}>{children}</View>
        )}
        {overlay ? <View style={styles.overlay}>{overlay}</View> : null}
        {selected ? (
          <View style={styles.check}>
            <Icon name="checkCircle" color={colors.accent} size={24} />
          </View>
        ) : null}
      </View>
      <View style={styles.labelBox}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {note ? (
          <Text style={styles.note} numberOfLines={2}>
            {note}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.card,
  },
  cardSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  pressed: { opacity: 0.85 },
  media: {
    borderTopLeftRadius: radius.xl - 2,
    borderTopRightRadius: radius.xl - 2,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  image: { width: '100%', height: '100%' },
  diagram: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  check: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
  },
  labelBox: { paddingVertical: spacing.md, paddingHorizontal: spacing.sm, alignItems: 'center' },
  label: { ...typography.label, color: colors.text },
  note: { ...typography.caption, color: colors.textSecondary, marginTop: 2, textAlign: 'center' },
});

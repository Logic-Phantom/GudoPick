import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { Icon } from '@/design-system/components';
import { colors, radius, spacing, typography } from '@/design-system/tokens';
import { GuidanceMessages } from '@/domain/composition/messages';
import type {
  CompositionProfile,
  GridKind,
  GuidanceDirection,
  GuidanceResult,
  Size,
  ViewRect,
} from '@/domain/composition/types';
import { TargetBrackets } from '@/features/onboarding/CompositionDiagram';

interface Props {
  size: Size;
  profile: CompositionProfile;
  result: GuidanceResult;
  cropRect: ViewRect | null;
  targetRect: ViewRect | null;
  subjectRect: ViewRect | null;
  /** 격자 표시 여부(설정/카메라 토글) */
  gridEnabled: boolean;
  /** 안내 문구 표시 여부(설정) */
  messagesEnabled: boolean;
}

/**
 * 카메라 프리뷰 위 가이드.
 * - 크롭 프레임(선택 비율) 바깥 마스크
 * - 3분할/중앙 격자
 * - 목표 위치·크기 고스트 가이드(브래킷)
 * - 현재 피사체 박스 — 실제 감지 결과가 있을 때만 그린다
 * - 센서 기반 수평선
 * - 안내 문구(위: 수평, 아래: 구도)
 *
 * 상태는 색만으로 구분하지 않고 아이콘·문구를 함께 쓴다.
 */
export function GuideOverlay({
  size,
  profile,
  result,
  cropRect,
  targetRect,
  subjectRect,
  gridEnabled,
  messagesEnabled,
}: Props) {
  if (!cropRect) return null;

  const ready = result.status === 'ready';
  const aligned = ready || result.status === 'almost';
  const intensity = profile.guidanceIntensity;
  const grid: GridKind = gridEnabled ? (profile.grid === 'none' ? 'thirds' : profile.grid) : 'none';
  const guideColor = aligned ? colors.accent : colors.onDark;

  const level = result.level;
  const showSubjectBox = subjectRect !== null && intensity !== 'subtle';
  const showArrow = intensity === 'strong' && result.status === 'adjusting' && targetRect !== null;

  const showLevelPill = messagesEnabled && level !== undefined && !level.isLevel;
  const showMainPill =
    messagesEnabled &&
    result.message.length > 0 &&
    // 수평 문구가 위에 이미 떠 있으면 같은 내용의 아래 문구는 생략한다.
    !(showLevelPill && result.direction === 'level');

  const { x, y, width, height } = cropRect;
  const centerY = targetRect ? targetRect.y + targetRect.height / 2 : y + height / 2;

  return (
    <View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="none">
      <Svg width={size.width} height={size.height}>
        {/* 크롭 프레임 바깥 마스크 */}
        <Rect x={0} y={0} width={size.width} height={y} fill={colors.cropMask} />
        <Rect x={0} y={y + height} width={size.width} height={Math.max(size.height - y - height, 0)} fill={colors.cropMask} />
        <Rect x={0} y={y} width={x} height={height} fill={colors.cropMask} />
        <Rect x={x + width} y={y} width={Math.max(size.width - x - width, 0)} height={height} fill={colors.cropMask} />

        {/* 격자 */}
        {grid === 'thirds'
          ? [1 / 3, 2 / 3].map((t) => (
              <Line key={`v${t}`} x1={x + width * t} y1={y} x2={x + width * t} y2={y + height} stroke={colors.guideLineSoft} strokeWidth={1} />
            ))
          : null}
        {grid === 'thirds'
          ? [1 / 3, 2 / 3].map((t) => (
              <Line key={`h${t}`} x1={x} y1={y + height * t} x2={x + width} y2={y + height * t} stroke={colors.guideLineSoft} strokeWidth={1} />
            ))
          : null}
        {grid === 'center' ? (
          <>
            <Line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} stroke={colors.guideLineSoft} strokeWidth={1} />
            <Line x1={x} y1={y + height / 2} x2={x + width} y2={y + height / 2} stroke={colors.guideLineSoft} strokeWidth={1} />
          </>
        ) : null}

        {/* 수평선: 기울기만큼 회전. 수평이 맞으면 라임 */}
        {level ? (
          <Line
            x1={x + width * 0.06}
            y1={centerY}
            x2={x + width * 0.94}
            y2={centerY}
            stroke={level.isLevel ? colors.accent : colors.guideLine}
            strokeWidth={level.isLevel ? 2 : 1.5}
            strokeDasharray={level.isLevel ? undefined : '6 6'}
            rotation={-level.rollDeg}
            origin={`${x + width / 2}, ${centerY}`}
          />
        ) : null}

        {/* 현재 피사체 박스 (감지된 경우에만) */}
        {showSubjectBox && subjectRect ? (
          <Rect
            x={subjectRect.x}
            y={subjectRect.y}
            width={subjectRect.width}
            height={subjectRect.height}
            rx={10}
            fill="none"
            stroke={aligned ? colors.accent : colors.guideLine}
            strokeWidth={1.5}
            strokeDasharray="5 5"
          />
        ) : null}

        {/* 목표 위치·크기 고스트 가이드 */}
        {targetRect ? (
          <TargetBrackets
            x={targetRect.x}
            y={targetRect.y}
            width={targetRect.width}
            height={targetRect.height}
            color={guideColor}
            strokeWidth={2.5}
          />
        ) : null}

        {/* 방향 화살표 (자세히) */}
        {showArrow && targetRect && result.direction ? (
          <DirectionArrow direction={result.direction} target={targetRect} />
        ) : null}
      </Svg>

      {showLevelPill ? (
        <View style={[styles.pillRow, { top: y + spacing.lg }]}>
          <Pill text={GuidanceMessages.level} />
        </View>
      ) : null}

      {showMainPill ? (
        <View style={[styles.pillRow, { top: y + height - spacing.lg - 36 }]}>
          <Pill text={result.message} ready={ready} live />
        </View>
      ) : null}
    </View>
  );
}

function Pill({ text, ready = false, live = false }: { text: string; ready?: boolean; live?: boolean }) {
  return (
    <View
      style={[styles.pill, ready && styles.pillReady]}
      accessible
      accessibilityLiveRegion={live ? 'polite' : 'none'}
      accessibilityLabel={text}>
      {ready ? <Icon name="check" size={16} color={colors.ink} strokeWidth={2.4} /> : null}
      <Text style={[styles.pillText, ready && styles.pillTextReady]} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

function DirectionArrow({ direction, target }: { direction: GuidanceDirection; target: ViewRect }) {
  const cx = target.x + target.width / 2;
  const cy = target.y + target.height / 2;
  const gap = 18;
  const len = 16;
  let d: string | null = null;
  switch (direction) {
    // 피사체가 이동해야 할 방향 = 목표 쪽. 피사체는 목표의 반대편에 있으므로 그쪽에서 목표를 향해 그린다.
    case 'left': {
      const sx = target.x + target.width + gap + len;
      d = `M ${sx} ${cy} H ${sx - len} M ${sx - len + 6} ${cy - 6} L ${sx - len} ${cy} L ${sx - len + 6} ${cy + 6}`;
      break;
    }
    case 'right': {
      const sx = target.x - gap - len;
      d = `M ${sx} ${cy} H ${sx + len} M ${sx + len - 6} ${cy - 6} L ${sx + len} ${cy} L ${sx + len - 6} ${cy + 6}`;
      break;
    }
    case 'up': {
      const sy = target.y + target.height + gap + len;
      d = `M ${cx} ${sy} V ${sy - len} M ${cx - 6} ${sy - len + 6} L ${cx} ${sy - len} L ${cx + 6} ${sy - len + 6}`;
      break;
    }
    case 'down': {
      const sy = target.y - gap - len;
      d = `M ${cx} ${sy} V ${sy + len} M ${cx - 6} ${sy + len - 6} L ${cx} ${sy + len} L ${cx + 6} ${sy + len - 6}`;
      break;
    }
    default:
      d = null;
  }
  if (!d) return null;
  return <Path d={d} stroke={colors.onDark} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
}

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  pillRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: spacing.xl },
  pill: {
    minHeight: 36,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
  pillReady: { backgroundColor: colors.accent },
  pillText: { ...typography.caption, fontSize: 13, color: colors.onDark, textAlign: 'center' },
  pillTextReady: { color: colors.ink, fontWeight: '700' },
});

import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { aspectRatioValue } from '@/domain/composition/geometry';
import { computeTargetBounds } from '@/domain/composition/target';
import type { CompositionProfile, GridKind, NormalizedRect } from '@/domain/composition/types';
import { colors } from '@/design-system/tokens';

/**
 * 자체 제작 벡터 구도 도식.
 * 프로필(또는 직접 지정한 격자/목표 영역)을 그대로 그려, 선택이 실제 가이드에 어떻게 반영되는지 보여준다.
 */
export function CompositionDiagram({
  size,
  profile,
  aspect,
  grid,
  target,
  tone = 'light',
  showFrame = true,
}: {
  /** 도식이 들어갈 정사각 영역의 한 변 */
  size: number;
  profile?: CompositionProfile;
  /** 프레임 가로/세로 비 (profile이 없을 때) */
  aspect?: number;
  grid?: GridKind;
  target?: NormalizedRect | null;
  /** light: 밝은 카드 위 / photo: 사진 위 오버레이 */
  tone?: 'light' | 'photo';
  showFrame?: boolean;
}) {
  const ratio = profile ? aspectRatioValue(profile.aspectRatio) : (aspect ?? 1);
  const gridKind = profile ? profile.grid : (grid ?? 'none');
  const targetRect =
    target !== undefined ? target : profile ? computeTargetBounds(profile, ratio) : null;

  const pad = tone === 'photo' ? 0 : size * 0.12;
  const available = size - pad * 2;
  const width = ratio >= 1 ? available : available * ratio;
  const height = ratio >= 1 ? available / ratio : available;
  const x0 = (size - width) / 2;
  const y0 = (size - height) / 2;

  const line = tone === 'photo' ? 'rgba(255,255,255,0.8)' : colors.borderStrong;
  const frame = tone === 'photo' ? 'transparent' : colors.text;
  const subject = tone === 'photo' ? '#FFFFFF' : colors.accentStrong;

  return (
    <Svg width={size} height={size} accessibilityElementsHidden importantForAccessibility="no">
      {showFrame && tone === 'light' ? (
        <Rect x={x0} y={y0} width={width} height={height} rx={6} fill={colors.surface} stroke={frame} strokeWidth={1.6} />
      ) : null}

      {gridKind === 'thirds'
        ? [1 / 3, 2 / 3].map((t) => (
            <Line key={`v${t}`} x1={x0 + width * t} y1={y0} x2={x0 + width * t} y2={y0 + height} stroke={line} strokeWidth={1} />
          ))
        : null}
      {gridKind === 'thirds'
        ? [1 / 3, 2 / 3].map((t) => (
            <Line key={`h${t}`} x1={x0} y1={y0 + height * t} x2={x0 + width} y2={y0 + height * t} stroke={line} strokeWidth={1} />
          ))
        : null}
      {gridKind === 'center' ? (
        <>
          <Line x1={x0 + width / 2} y1={y0} x2={x0 + width / 2} y2={y0 + height} stroke={line} strokeWidth={1} />
          <Line x1={x0} y1={y0 + height / 2} x2={x0 + width} y2={y0 + height / 2} stroke={line} strokeWidth={1} />
        </>
      ) : null}

      {targetRect ? (
        <TargetBrackets
          x={x0 + targetRect.x * width}
          y={y0 + targetRect.y * height}
          width={targetRect.width * width}
          height={targetRect.height * height}
          color={subject}
        />
      ) : null}
    </Svg>
  );
}

/** 목표 영역 표시: 네 모서리 브래킷 + 가운데 점 */
export function TargetBrackets({
  x,
  y,
  width,
  height,
  color,
  strokeWidth = 2,
  showDot = true,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  strokeWidth?: number;
  showDot?: boolean;
}) {
  const arm = Math.max(Math.min(width, height) * 0.24, 4);
  const r = Math.min(arm * 0.6, 8);
  const x1 = x + width;
  const y1 = y + height;
  const d = [
    `M ${x} ${y + arm} V ${y + r} Q ${x} ${y} ${x + r} ${y} H ${x + arm}`,
    `M ${x1 - arm} ${y} H ${x1 - r} Q ${x1} ${y} ${x1} ${y + r} V ${y + arm}`,
    `M ${x1} ${y1 - arm} V ${y1 - r} Q ${x1} ${y1} ${x1 - r} ${y1} H ${x1 - arm}`,
    `M ${x + arm} ${y1} H ${x + r} Q ${x} ${y1} ${x} ${y1 - r} V ${y1 - arm}`,
  ].join(' ');
  return (
    <>
      <Path d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
      {showDot ? (
        <Circle cx={x + width / 2} cy={y + height / 2} r={Math.max(strokeWidth * 1.2, 2.5)} fill={color} />
      ) : null}
    </>
  );
}

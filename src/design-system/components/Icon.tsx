import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { colors } from '../tokens';

/**
 * 자체 제작 아이콘 세트 (24×24, 선 아이콘).
 * 외부 아이콘 폰트/이미지를 번들하지 않는다.
 */
export type IconName =
  | 'home'
  | 'layers'
  | 'settings'
  | 'camera'
  | 'flash'
  | 'flashOff'
  | 'flip'
  | 'arrowRight'
  | 'chevronRight'
  | 'chevronLeft'
  | 'check'
  | 'checkCircle'
  | 'pencil'
  | 'plus'
  | 'sliders'
  | 'info'
  | 'vibrate'
  | 'message'
  | 'shield'
  | 'code'
  | 'grid'
  | 'level'
  | 'trash'
  | 'copy'
  | 'close'
  | 'star'
  | 'target'
  | 'refresh';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, color = colors.text, strokeWidth = 1.8 }: IconProps) {
  const stroke = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {renderIcon(name, stroke, color)}
    </Svg>
  );
}

type StrokeProps = {
  stroke: string;
  strokeWidth: number;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
  fill: string;
};

function renderIcon(name: IconName, s: StrokeProps, color: string) {
  switch (name) {
    case 'home':
      return (
        <>
          <Path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" {...s} />
          <Path d="M9.5 20.5v-6h5v6" {...s} />
        </>
      );
    case 'layers':
      return (
        <>
          <Path d="m12 3.5 8.5 4.5L12 12.5 3.5 8 12 3.5Z" {...s} />
          <Path d="m3.5 12 8.5 4.5 8.5-4.5" {...s} />
          <Path d="m3.5 16 8.5 4.5 8.5-4.5" {...s} />
        </>
      );
    case 'settings':
      return (
        <>
          <Circle cx="12" cy="12" r="3" {...s} />
          <Path
            d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.9-1.4-2-3.4-2.2.9a7.6 7.6 0 0 0-2.6-1.5L14.2 2.8h-4l-.3 2.3a7.6 7.6 0 0 0-2.6 1.5l-2.2-.9-2 3.4L5 10.5a7.6 7.6 0 0 0 0 3l-1.9 1.4 2 3.4 2.2-.9a7.6 7.6 0 0 0 2.6 1.5l.3 2.3h4l.3-2.3a7.6 7.6 0 0 0 2.6-1.5l2.2.9 2-3.4-1.9-1.4Z"
            {...s}
          />
        </>
      );
    case 'camera':
      return (
        <>
          <Path
            d="M4.5 8h2.6l1.3-2.2h7.2L16.9 8h2.6A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-8A1.5 1.5 0 0 1 4.5 8Z"
            {...s}
          />
          <Circle cx="12" cy="13.2" r="3.3" {...s} />
        </>
      );
    case 'flash':
      return <Path d="M13 2.5 5.5 13.5H11l-1 8 7.5-11H12l1-8Z" {...s} />;
    case 'flashOff':
      return (
        <>
          <Path d="M13 2.5 5.5 13.5H11l-1 8 7.5-11H12l1-8Z" {...s} />
          <Line x1="4" y1="4" x2="20" y2="20" {...s} />
        </>
      );
    case 'flip':
      return (
        <>
          <Path
            d="M4.5 8h2.6l1.3-2.2h7.2L16.9 8h2.6A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-8A1.5 1.5 0 0 1 4.5 8Z"
            {...s}
          />
          <Path d="M9 13.5a3 3 0 0 1 5.4-1.8M15 13.5a3 3 0 0 1-5.4 1.8" {...s} />
          <Path d="m14.6 9.9-.1 1.9-1.9-.2M9.4 17.1l.1-1.9 1.9.2" {...s} />
        </>
      );
    case 'arrowRight':
      return <Path d="M4.5 12h15m-5.5-5.5L19.5 12 14 17.5" {...s} />;
    case 'chevronRight':
      return <Path d="m9 5.5 6.5 6.5L9 18.5" {...s} />;
    case 'chevronLeft':
      return <Path d="M15 5.5 8.5 12l6.5 6.5" {...s} />;
    case 'check':
      return <Path d="m4.5 12.5 5 5 10-11" {...s} />;
    case 'checkCircle':
      return (
        <>
          <Circle cx="12" cy="12" r="10" fill={color} />
          <Path d="m7.5 12.3 3 3 6-6.6" {...s} stroke="#FFFFFF" strokeWidth={2.2} />
        </>
      );
    case 'pencil':
      return (
        <>
          <Path d="m4 20 1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5 4 20Z" {...s} />
          <Path d="m14.5 6 3.5 3.5" {...s} />
        </>
      );
    case 'plus':
      return <Path d="M12 5v14M5 12h14" {...s} />;
    case 'sliders':
      return (
        <>
          <Line x1="4" y1="7" x2="20" y2="7" {...s} />
          <Line x1="4" y1="12" x2="20" y2="12" {...s} />
          <Line x1="4" y1="17" x2="20" y2="17" {...s} />
          <Circle cx="15" cy="7" r="2" {...s} fill="#000000" />
          <Circle cx="9" cy="12" r="2" {...s} fill="#000000" />
          <Circle cx="14" cy="17" r="2" {...s} fill="#000000" />
        </>
      );
    case 'info':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...s} />
          <Line x1="12" y1="11" x2="12" y2="16" {...s} />
          <Circle cx="12" cy="8" r="0.6" {...s} fill={color} />
        </>
      );
    case 'vibrate':
      return (
        <>
          <Rect x="8" y="4" width="8" height="16" rx="2" {...s} />
          <Path d="M4.5 9v6M2 10.5v3M19.5 9v6M22 10.5v3" {...s} />
        </>
      );
    case 'message':
      return (
        <>
          <Path d="M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17A1.5 1.5 0 0 1 4 15.5v-9Z" {...s} />
          <Path d="M8 9.5h8M8 12.5h5" {...s} />
        </>
      );
    case 'shield':
      return (
        <>
          <Path d="M12 3 5 5.8v5.6c0 4.3 2.9 7.6 7 9.1 4.1-1.5 7-4.8 7-9.1V5.8L12 3Z" {...s} />
          <Path d="m9 12 2.2 2.2L15 10" {...s} />
        </>
      );
    case 'code':
      return <Path d="m8.5 7.5-5 4.5 5 4.5M15.5 7.5l5 4.5-5 4.5M13.5 5l-3 14" {...s} />;
    case 'grid':
      return (
        <>
          <Rect x="3.5" y="3.5" width="17" height="17" rx="2" {...s} />
          <Path d="M9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" {...s} />
        </>
      );
    case 'level':
      return (
        <>
          <Line x1="3" y1="12" x2="21" y2="12" {...s} />
          <Circle cx="12" cy="12" r="3" {...s} />
        </>
      );
    case 'trash':
      return (
        <>
          <Path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.8 12a1.5 1.5 0 0 0 1.5 1.5h6.4a1.5 1.5 0 0 0 1.5-1.5L17.5 7" {...s} />
          <Path d="M10 11v5.5M14 11v5.5" {...s} />
        </>
      );
    case 'copy':
      return (
        <>
          <Rect x="8.5" y="8.5" width="11" height="11" rx="2" {...s} />
          <Path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" {...s} />
        </>
      );
    case 'close':
      return <Path d="m6 6 12 12M18 6 6 18" {...s} />;
    case 'star':
      return (
        <Path
          d="M12 2c.5 5.6 4.4 9.5 10 10-5.6.5-9.5 4.4-10 10-.5-5.6-4.4-9.5-10-10 5.6-.5 9.500-4.4 10-10Z"
          fill={color}
        />
      );
    case 'target':
      return (
        <>
          <Path d="M8 4.5H6A1.5 1.5 0 0 0 4.500 6v2M16 4.500h2A1.500 1.500 0 0 1 19.500 6v2M8 19.500H6A1.500 1.500 0 0 1 4.500 18v-2M16 19.500h2a1.500 1.500 0 0 0 1.500-1.500v-2" {...s} />
          <Circle cx="12" cy="12" r="1.4" fill={color} />
        </>
      );
    case 'refresh':
      return (
        <>
          <Path d="M19.500 12a7.500 7.500 0 1 1-2.400-5.500" {...s} />
          <Path d="M19.500 4.500v4h-4" {...s} />
        </>
      );
  }
}

import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * 구도픽 디자인 토큰.
 * 목업 기준: 밝은 화이트 UI(온보딩/홈/프리셋/설정) + 블랙 카메라/검토 화면, 포인트는 라임 1색.
 * 화면 코드는 색상 값을 직접 쓰지 않고 이 토큰만 참조한다 (추후 테마 추가 대비).
 */
export const colors = {
  // 밝은 화면
  background: '#FFFFFF',
  backgroundMuted: '#F6F6F4',
  surface: '#FFFFFF',
  surfaceMuted: '#F3F3F1',
  border: '#ECECEA',
  borderStrong: '#DDDDDA',
  text: '#111111',
  textSecondary: '#6E6E6A',
  textTertiary: '#A3A39F',
  ink: '#111111',
  onInk: '#FFFFFF',

  // 포인트
  accent: '#84CC16',
  accentStrong: '#65A30D',
  accentSoft: '#F1F9E1',
  onAccent: '#FFFFFF',

  // 어두운 화면(카메라/검토)
  dark: '#000000',
  darkSurface: '#1C1C1E',
  darkSurfaceRaised: '#2A2A2D',
  onDark: '#FFFFFF',
  onDarkSecondary: 'rgba(255,255,255,0.72)',
  scrim: 'rgba(0,0,0,0.55)',
  guideLine: 'rgba(255,255,255,0.75)',
  guideLineSoft: 'rgba(255,255,255,0.45)',
  cropMask: 'rgba(0,0,0,0.55)',

  danger: '#D92D20',
  warning: '#F5A524',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  screen: 24,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

const fontFamily = Platform.select({ ios: 'System', default: undefined });

export const typography = {
  display: { fontFamily, fontSize: 30, lineHeight: 38, fontWeight: '800', letterSpacing: -0.6 },
  title: { fontFamily, fontSize: 26, lineHeight: 34, fontWeight: '800', letterSpacing: -0.5 },
  heading: { fontFamily, fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontFamily, fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontFamily, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  label: { fontFamily, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontFamily, fontSize: 12, lineHeight: 16, fontWeight: '500' },
  button: { fontFamily, fontSize: 15, lineHeight: 20, fontWeight: '700' },
} as const satisfies Record<string, TextStyle>;

export const shadows = {
  card: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.07,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },
    default: { elevation: 3 },
  }) as ViewStyle,
  raised: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.16,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    default: { elevation: 6 },
  }) as ViewStyle,
} as const;

/** 터치 영역 최소 크기 (접근성) */
export const MIN_TOUCH = 44;

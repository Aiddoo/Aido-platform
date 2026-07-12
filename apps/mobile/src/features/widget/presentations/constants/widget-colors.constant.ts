/**
 * 위젯 전용 컬러 팔레트 — global.css 디자인 토큰의 hex 고정본.
 *
 * 위젯(iOS 확장/Android RemoteViews)은 CSS 변수·Uniwind를 읽을 수 없어
 * OKLCH 토큰을 빌드 타임 hex로 변환해 사용한다. 토큰 값이 바뀌면 여기도 갱신할 것.
 * 위젯은 앱 내 테마 오버라이드가 아닌 OS 시스템 테마를 따른다(플랫폼 표준).
 */
export type WidgetTheme = 'light' | 'dark';

/** react-native-android-widget ColorProp과 호환되는 hex 리터럴 타입 */
export type WidgetHexColor = `#${string}`;

export interface WidgetPalette {
  /** --background */
  background: WidgetHexColor;
  /** --foreground */
  foreground: WidgetHexColor;
  /** --muted */
  muted: WidgetHexColor;
  /** --divider (1px 헤어라인) */
  divider: WidgetHexColor;
  /** 프로그레스 트랙 (light: --gray-3 / dark: --default) */
  track: WidgetHexColor;
  /** --main 브랜드 오렌지 — 프로그레스 필·체크·스트릭 포인트에만 사용 */
  brand: WidgetHexColor;
}

export const WIDGET_COLORS: Record<WidgetTheme, WidgetPalette> = {
  light: {
    background: '#FFFFFF',
    foreground: '#333333',
    muted: '#8F8F8F',
    divider: '#DEDEDE',
    track: '#EBEBEB',
    brand: '#FF6B43',
  },
  dark: {
    background: '#121212',
    foreground: '#F5F5F5',
    muted: '#B7B7B7',
    divider: '#636363',
    track: '#333333',
    brand: '#FF6B43',
  },
} as const;

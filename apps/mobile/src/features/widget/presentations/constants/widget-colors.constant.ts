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
  /** --main 브랜드 오렌지 — 히어로 숫자·프로그레스·스트릭·완료 축하의 단일 포인트 컬러 */
  brand: WidgetHexColor;
  /** 프로그레스 그라데이션 끝색 (--main 기점의 밝은 오렌지) */
  brandSoft: WidgetHexColor;
}

export const WIDGET_COLORS: Record<WidgetTheme, WidgetPalette> = {
  light: {
    background: '#FFFFFF',
    foreground: '#333333',
    muted: '#8F8F8F',
    divider: '#DEDEDE',
    track: '#EBEBEB',
    brand: '#FF6B43',
    brandSoft: '#FF9E77',
  },
  dark: {
    // 순수 블랙 대신 --main 기운이 도는 웜 블랙 — 다크 홈 화면에서 브랜드 존재감
    background: '#171310',
    foreground: '#F5F5F5',
    muted: '#B7B7B7',
    divider: '#636363',
    track: '#333333',
    brand: '#FF6B43',
    brandSoft: '#FF9E77',
  },
} as const;

function isWidgetHexColor(value: string): value is WidgetHexColor {
  return value.startsWith('#');
}

/** 서버가 내려준 카테고리 색상(HEX 계약)을 안전하게 내로잉 — 계약 위반 시 브랜드로 폴백 */
export function toWidgetHexColor(value: string, fallback: WidgetHexColor): WidgetHexColor {
  return isWidgetHexColor(value) ? value : fallback;
}

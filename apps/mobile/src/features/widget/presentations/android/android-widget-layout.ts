/** app.config.ts의 react-native-android-widget widgets[].name과 일치해야 한다. */
export const ANDROID_WIDGET_NAMES = [
  'AidoTodaySummary',
  'AidoTodayList',
  'AidoTodayLarge',
] as const;

export type AndroidWidgetName = (typeof ANDROID_WIDGET_NAMES)[number];
export type AndroidWidgetFamily = 'small' | 'medium' | 'large';

const LEGACY_SMALL_WIDTH_THRESHOLD_DP = 200;
const LEGACY_LARGE_HEIGHT_THRESHOLD_DP = 220;

export function isAndroidWidgetName(name: string): name is AndroidWidgetName {
  return ANDROID_WIDGET_NAMES.some((widgetName) => widgetName === name);
}

/**
 * 신규 small/large는 launcher가 보고한 크기가 부정확해도 이름으로 고정한다.
 *
 * AidoTodayList는 v1.5.1에서 자유 리사이즈였던 기존 인스턴스가 남을 수 있어
 * 2x2/4x4 크기만 호환 보정하고, 일반적인 신규 크기는 medium으로 해석한다.
 */
export function resolveAndroidWidgetFamily(
  widgetName: AndroidWidgetName,
  widthDp: number,
  heightDp: number,
): AndroidWidgetFamily {
  if (widgetName === 'AidoTodaySummary') {
    return 'small';
  }
  if (widgetName === 'AidoTodayLarge') {
    return 'large';
  }
  if (widthDp < LEGACY_SMALL_WIDTH_THRESHOLD_DP) {
    return 'small';
  }
  if (heightDp >= LEGACY_LARGE_HEIGHT_THRESHOLD_DP) {
    return 'large';
  }
  return 'medium';
}

export function rowsForAndroidWidgetFamily(family: AndroidWidgetFamily): number {
  if (family === 'large') {
    return 8;
  }
  if (family === 'medium') {
    return 3;
  }
  return 0;
}

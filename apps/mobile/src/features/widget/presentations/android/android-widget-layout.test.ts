import {
  ANDROID_WIDGET_NAMES,
  isAndroidWidgetName,
  resolveAndroidWidgetFamily,
  rowsForAndroidWidgetFamily,
} from './android-widget-layout';

describe('Android widget layout policy', () => {
  it('config와 공유하는 세 위젯 이름만 허용한다', () => {
    expect(ANDROID_WIDGET_NAMES).toEqual(['AidoTodaySummary', 'AidoTodayList', 'AidoTodayLarge']);
    expect(isAndroidWidgetName('AidoTodayList')).toBe(true);
    expect(isAndroidWidgetName('UnknownWidget')).toBe(false);
  });

  it.each([
    ['AidoTodaySummary', 400, 400, 'small'],
    ['AidoTodayList', 250, 110, 'medium'],
    ['AidoTodayLarge', 110, 110, 'large'],
  ] as const)(
    '%s는 launcher 보고 크기와 무관한 기본 family를 선택한다',
    (name, width, height, family) => {
      expect(resolveAndroidWidgetFamily(name, width, height)).toBe(family);
    },
  );

  it('기존 AidoTodayList 2x2/4x4 인스턴스의 실제 크기를 호환한다', () => {
    expect(resolveAndroidWidgetFamily('AidoTodayList', 110, 110)).toBe('small');
    expect(resolveAndroidWidgetFamily('AidoTodayList', 250, 250)).toBe('large');
  });

  it.each([
    ['small', 0],
    ['medium', 3],
    ['large', 8],
  ] as const)('%s family는 %i개 행을 사용한다', (family, rows) => {
    expect(rowsForAndroidWidgetFamily(family)).toBe(rows);
  });
});

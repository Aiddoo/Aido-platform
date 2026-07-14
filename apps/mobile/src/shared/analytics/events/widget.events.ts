/**
 * 홈 위젯 채택 지표.
 *
 * widget_added/removed는 Android AppWidget 시스템 이벤트(WIDGET_ADDED/WIDGET_DELETED)로만
 * 정확히 감지된다. iOS WidgetKit은 추가/제거 콜백을 제공하지 않아 미집계(알려진 한계).
 */
export interface WidgetEventMap {
  widget_added: {
    widget_name: 'AidoTodaySummary' | 'AidoTodayList' | 'AidoTodayLarge';
  };
  widget_removed: {
    widget_name: 'AidoTodaySummary' | 'AidoTodayList' | 'AidoTodayLarge';
  };
}

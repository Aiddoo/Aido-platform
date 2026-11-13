import type { findWidgetEntry } from '../utils/widget-navigation-link.view-model';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    /** 위젯을 눌러 앱이 그 목적지를 연 순간. 로그인 전·다른 계정·만료된 탭은 세지 않는다 */
    widget_opened: {
      destination: NonNullable<ReturnType<typeof findWidgetEntry>>['openedDestination'];
    };
  }
}

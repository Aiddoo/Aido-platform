import { track } from '@src/shared/analytics';
import { formatDate } from '@src/shared/utils/date';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import {
  isAndroidWidgetName,
  renderAndroidWidget,
  renderAndroidWidgetFallback,
} from '../presentations/android/render-android-widgets';
import { WidgetSnapshotRepositoryImpl } from '../repositories/widget-snapshot.repository';
import { widgetSyncStorage } from '../repositories/widget-storage';
import { createFallbackSnapshot } from '../services/widget-fallback';
import { getWidgetAnalytics, getWidgetErrorReporter } from './widget-analytics';

// 핸들러는 OS가 반복 호출하는 핫패스 — 저장소 래퍼는 모듈 싱글턴으로 1회만 생성
const repository = new WidgetSnapshotRepositoryImpl(widgetSyncStorage);

/**
 * Android 위젯 headless 엔트리 — 읽기 + 렌더만 수행한다.
 *
 * 세션 불변식: 이 핸들러는 네트워크·토큰·SecureStore에 접근하지 않는다.
 * 데이터 갱신은 전적으로 앱(useWidgetSnapshotSync)이 담당하고,
 * 여기서는 저장된 스냅샷을 시스템 요청 시점에 다시 그릴 뿐이다.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetInfo, widgetAction, renderWidget } = props;

  if (!isAndroidWidgetName(widgetInfo.widgetName)) {
    return;
  }

  // 위젯 채택 지표 — 분석 실패가 렌더를 막지 않도록 격리
  try {
    if (widgetAction === 'WIDGET_ADDED') {
      track(getWidgetAnalytics(), 'widget_added', { widget_name: widgetInfo.widgetName });
    }
    if (widgetAction === 'WIDGET_DELETED') {
      track(getWidgetAnalytics(), 'widget_removed', { widget_name: widgetInfo.widgetName });
    }
  } catch (error) {
    getWidgetErrorReporter().captureException(
      error instanceof Error ? error : new Error(String(error)),
      { feature: 'widget', method: 'widgetTaskHandler.analytics' },
    );
  }

  if (widgetAction === 'WIDGET_DELETED') {
    return;
  }

  // WIDGET_ADDED / WIDGET_UPDATE(주기 갱신 — 자정 롤오버 안전망) / WIDGET_RESIZED / WIDGET_CLICK
  try {
    const now = new Date();
    const todayLocalDate = formatDate(now);
    const snapshot = repository.read() ?? createFallbackSnapshot(todayLocalDate, now);

    renderWidget(
      renderAndroidWidget({
        snapshot,
        widgetName: widgetInfo.widgetName,
        todayLocalDate,
        widthDp: widgetInfo.width,
        heightDp: widgetInfo.height,
      }),
    );
  } catch (error) {
    getWidgetErrorReporter().captureException(
      error instanceof Error ? error : new Error(String(error)),
      { feature: 'widget', method: 'widgetTaskHandler.render' },
    );

    // 첫 추가 시 주 렌더가 실패해도 빈 위젯으로 남기지 않는다. fallback 실패까지
    // 앱 프로세스로 전파하지 않고 별도 method로 관측한다.
    try {
      const now = new Date();
      const todayLocalDate = formatDate(now);
      const fallbackSnapshot = repository.read() ?? createFallbackSnapshot(todayLocalDate, now);
      renderWidget(renderAndroidWidgetFallback(fallbackSnapshot));
    } catch (fallbackError) {
      getWidgetErrorReporter().captureException(
        fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)),
        { feature: 'widget', method: 'widgetTaskHandler.fallback' },
      );
    }
  }
}

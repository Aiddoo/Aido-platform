import { formatDate } from '@src/shared/utils/date';
import { requestWidgetUpdate } from 'react-native-android-widget';

import type { WidgetSnapshot } from '../models/widget-snapshot.model';
import {
  ANDROID_WIDGET_NAMES,
  listRowsForHeight,
  renderAndroidWidget,
} from '../presentations/android/render-android-widgets';
import type { WidgetSnapshotRepository } from '../repositories/widget-snapshot.repository';
import type { WidgetBridge } from './widget-bridge';

/**
 * Android 브리지 — 스냅샷을 MMKV에 영속화하고 홈 화면의 위젯을 즉시 다시 그린다.
 *
 * 영속화는 시스템 주기 갱신(task handler)이 같은 데이터를 읽게 하기 위함이고,
 * requestWidgetUpdate는 홈 화면에 추가된 위젯 인스턴스별로 콜백을 호출한다.
 */
export function createAndroidWidgetBridge(repository: WidgetSnapshotRepository): WidgetBridge {
  return {
    async writeSnapshot(snapshot: WidgetSnapshot): Promise<void> {
      repository.write(snapshot);

      const todayLocalDate = formatDate(new Date());

      await Promise.all(
        ANDROID_WIDGET_NAMES.map((widgetName) =>
          requestWidgetUpdate({
            widgetName,
            renderWidget: (widgetInfo) =>
              renderAndroidWidget({
                widgetName,
                snapshot,
                todayLocalDate,
                maxRows: listRowsForHeight(widgetInfo.height),
              }),
            // 홈 화면에 해당 위젯이 없으면 조용히 무시 (앱 동작에 영향 없음)
            widgetNotFound: () => {},
          }),
        ),
      );
    },
  };
}

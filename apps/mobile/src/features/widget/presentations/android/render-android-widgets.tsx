import type { WidgetRepresentation } from 'react-native-android-widget';

import { type WidgetSnapshot, WidgetSnapshotPolicy } from '../../models/widget-snapshot.model';
import { type AndroidWidgetName, resolveAndroidWidgetFamily } from './android-widget-layout';
import { TodayListWidget } from './today-list-widget';
import { StateWidget } from './widget-primitives';

export { ANDROID_WIDGET_NAMES, isAndroidWidgetName } from './android-widget-layout';

export interface RenderAndroidWidgetInput {
  snapshot: WidgetSnapshot;
  widgetName: AndroidWidgetName;
  /** 렌더 시점의 로컬 날짜 (YYYY-MM-DD) — 자정 롤오버 판정 */
  todayLocalDate: string;
  /** 기존 AidoTodayList 인스턴스 호환 보정에만 사용한다. */
  widthDp: number;
  heightDp: number;
}

/** 스냅샷 → 라이트/다크 렌더 트리 (시스템 테마는 launcher가 선택). */
export function renderAndroidWidget({
  snapshot,
  widgetName,
  todayLocalDate,
  widthDp,
  heightDp,
}: RenderAndroidWidgetInput): WidgetRepresentation {
  const renderState = WidgetSnapshotPolicy.renderState(snapshot, todayLocalDate);
  const family = resolveAndroidWidgetFamily(widgetName, widthDp, heightDp);

  return {
    light: (
      <TodayListWidget
        snapshot={snapshot}
        theme="light"
        renderState={renderState}
        family={family}
      />
    ),
    dark: (
      <TodayListWidget snapshot={snapshot} theme="dark" renderState={renderState} family={family} />
    ),
  };
}

/** 주 렌더러가 실패해도 첫 추가 위젯을 빈 화면으로 남기지 않는 최소 안전 화면. */
export function renderAndroidWidgetFallback(snapshot: WidgetSnapshot): WidgetRepresentation {
  const strings = WidgetSnapshotPolicy.stateScreenStrings(snapshot, 'stale');
  return {
    light: <StateWidget theme="light" title={strings.title} cta={strings.cta} />,
    dark: <StateWidget theme="dark" title={strings.title} cta={strings.cta} />,
  };
}

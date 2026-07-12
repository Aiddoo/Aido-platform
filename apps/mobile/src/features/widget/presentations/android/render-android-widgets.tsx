import type { WidgetRepresentation } from 'react-native-android-widget';

import { type WidgetSnapshot, WidgetSnapshotPolicy } from '../../models/widget-snapshot.model';
import { ProgressWidget } from './progress-widget';
import { TodayListWidget } from './today-list-widget';

/** app.config.ts의 react-native-android-widget widgets[].name과 일치해야 한다 */
export const ANDROID_WIDGET_NAMES = ['AidoProgress', 'AidoTodayList'] as const;
export type AndroidWidgetName = (typeof ANDROID_WIDGET_NAMES)[number];

export function isAndroidWidgetName(name: string): name is AndroidWidgetName {
  return ANDROID_WIDGET_NAMES.some((widgetName) => widgetName === name);
}

const LIST_ROW_HEIGHT_DP = 32;
const LIST_CHROME_HEIGHT_DP = 60;
const LIST_MIN_ROWS = 3;
const LIST_MAX_ROWS = 7;

/** 위젯 높이(dp) → 리스트 표시 행 수 (4x2: 3행, 세로 확장 시 최대 7행) */
export function listRowsForHeight(heightDp: number): number {
  const rows = Math.floor((heightDp - LIST_CHROME_HEIGHT_DP) / LIST_ROW_HEIGHT_DP);
  return Math.min(LIST_MAX_ROWS, Math.max(LIST_MIN_ROWS, rows));
}

export interface RenderAndroidWidgetInput {
  widgetName: AndroidWidgetName;
  snapshot: WidgetSnapshot;
  /** 렌더 시점의 로컬 날짜 (YYYY-MM-DD) — 자정 롤오버 판정 */
  todayLocalDate: string;
  /** 리스트 위젯의 표시 행 수 */
  maxRows: number;
}

/** 스냅샷 → 라이트/다크 렌더 트리 (시스템 테마는 launcher가 선택) */
export function renderAndroidWidget({
  widgetName,
  snapshot,
  todayLocalDate,
  maxRows,
}: RenderAndroidWidgetInput): WidgetRepresentation {
  const renderState = WidgetSnapshotPolicy.renderState(snapshot, todayLocalDate);

  if (widgetName === 'AidoTodayList') {
    return {
      light: (
        <TodayListWidget
          snapshot={snapshot}
          theme="light"
          renderState={renderState}
          maxRows={maxRows}
        />
      ),
      dark: (
        <TodayListWidget
          snapshot={snapshot}
          theme="dark"
          renderState={renderState}
          maxRows={maxRows}
        />
      ),
    };
  }

  return {
    light: <ProgressWidget snapshot={snapshot} theme="light" renderState={renderState} />,
    dark: <ProgressWidget snapshot={snapshot} theme="dark" renderState={renderState} />,
  };
}

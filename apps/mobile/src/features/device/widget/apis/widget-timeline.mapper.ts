import type { Instant } from '@src/shared/date/instant';
import { instantToDate } from '@src/shared/date/native-date';
import { getNextLocalMidnight, toDateKey } from '@src/shared/date/zoned';
import type { WidgetTimelineEntry } from 'expo-widgets';

import { WidgetSnapshotPolicy } from '../domains/widget-snapshot.model';
import type { WidgetProps } from '../schemas/widget-props-payload.schema';
import type { StoredWidgetSnapshot } from '../schemas/widget-snapshot-storage.schema';
import { toWidgetProps } from './widget-props.mapper';

interface WidgetTimelineContext {
  now: Instant;
  /** LocalDateProvider와 같은 기기 시간대 — 자정 경계를 이 시간대로 계산한다 */
  timezone: string;
  appScheme: string;
}

// [지금: 오늘] → [다음 자정: 내일(없으면 stale)] → [그다음 자정: stale]이고 WidgetKit이 앱 없이 자정에 넘긴다
export function toWidgetTimelineEntries(
  snapshot: StoredWidgetSnapshot,
  { now, timezone, appScheme }: WidgetTimelineContext,
): WidgetTimelineEntry<WidgetProps>[] {
  const current = WidgetSnapshotPolicy.getDay(snapshot, toDateKey(now, timezone));
  const entries: WidgetTimelineEntry<WidgetProps>[] = [
    { date: instantToDate(now), props: toWidgetProps(current.day, current.renderState, appScheme) },
  ];
  if (current.renderState === 'loggedOut' || current.renderState === 'stale') {
    return entries;
  }

  const firstBoundary = getNextLocalMidnight(now, timezone);
  const nextDay = snapshot.days.find((day) => day.date === toDateKey(firstBoundary, timezone));
  if (nextDay == null) {
    entries.push({
      date: instantToDate(firstBoundary),
      props: toWidgetProps(current.day, 'stale', appScheme),
    });
    return entries;
  }

  entries.push(
    { date: instantToDate(firstBoundary), props: toWidgetProps(nextDay, nextDay.state, appScheme) },
    {
      date: instantToDate(getNextLocalMidnight(firstBoundary, timezone)),
      props: toWidgetProps(nextDay, 'stale', appScheme),
    },
  );
  return entries;
}

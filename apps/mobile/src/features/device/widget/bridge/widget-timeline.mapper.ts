import type { Instant } from '@src/shared/date/instant';
import { instantToDate } from '@src/shared/date/native-date';
import { getNextLocalMidnight, toDateKey } from '@src/shared/date/zoned';
import type { WidgetTimelineEntry } from 'expo-widgets';

import { toWidgetProps } from '../apis/widget-props.mapper';
import { WidgetSnapshotPolicy } from '../domains/widget-snapshot.model';
import type { WidgetProps } from '../schemas/widget-props-payload.schema';
import { type WidgetSnapshot } from '../schemas/widget-snapshot-storage.schema';

interface WidgetTimelineContext {
  now: Instant;
  /** LocalDateProvider와 같은 기기 시간대 — 자정 경계를 이 시간대로 계산한다 */
  timeZone: string;
  appScheme: string;
}

// [지금: 오늘] → [다음 자정: 내일(없으면 stale)] → [그다음 자정: stale]이고 WidgetKit이 앱 없이 자정에 넘긴다
export function toWidgetTimelineEntries(
  snapshot: WidgetSnapshot,
  { now, timeZone, appScheme }: WidgetTimelineContext,
): WidgetTimelineEntry<WidgetProps>[] {
  const current = WidgetSnapshotPolicy.getDay(snapshot, toDateKey(now, timeZone));
  const entries: WidgetTimelineEntry<WidgetProps>[] = [
    { date: instantToDate(now), props: toWidgetProps(current.day, current.renderState, appScheme) },
  ];
  if (current.renderState === 'loggedOut' || current.renderState === 'stale') {
    return entries;
  }

  const firstBoundary = getNextLocalMidnight(now, timeZone);
  const nextDay = snapshot.days.find((day) => day.date === toDateKey(firstBoundary, timeZone));
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
      date: instantToDate(getNextLocalMidnight(firstBoundary, timeZone)),
      props: toWidgetProps(nextDay, 'stale', appScheme),
    },
  );
  return entries;
}

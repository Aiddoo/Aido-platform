import { toDateKey } from '@src/shared/date/instant';
import { getNextLocalMidnight } from '@src/shared/date/local-date-clock';
import type { WidgetTimelineEntry } from 'expo-widgets';

import { toWidgetProps } from '../apis/widget-props.mapper';
import { WidgetSnapshotPolicy } from '../domains/widget-snapshot.model';
import type { WidgetProps } from '../schemas/widget-props.schema';
import { type WidgetSnapshot } from '../schemas/widget-snapshot.schema';

interface WidgetTimelineContext {
  now: Date;
  timeZone: string;
  appScheme: string;
}

/** snapshot → iOS timeline */
export function toWidgetTimelineEntries(
  snapshot: WidgetSnapshot,
  { now, timeZone, appScheme }: WidgetTimelineContext,
): WidgetTimelineEntry<WidgetProps>[] {
  const current = WidgetSnapshotPolicy.getDay(snapshot, toDateKey(now, timeZone));
  const entries: WidgetTimelineEntry<WidgetProps>[] = [
    { date: now, props: toWidgetProps(current.day, current.renderState, appScheme) },
  ];
  if (current.renderState === 'loggedOut' || current.renderState === 'stale') {
    return entries;
  }

  const firstBoundary = getNextLocalMidnight(now, timeZone);
  const nextDay = snapshot.days.find((day) => day.date === toDateKey(firstBoundary, timeZone));
  if (nextDay == null) {
    entries.push({ date: firstBoundary, props: toWidgetProps(current.day, 'stale', appScheme) });
    return entries;
  }

  entries.push(
    { date: firstBoundary, props: toWidgetProps(nextDay, nextDay.state, appScheme) },
    {
      date: getNextLocalMidnight(firstBoundary, timeZone),
      props: toWidgetProps(nextDay, 'stale', appScheme),
    },
  );
  return entries;
}

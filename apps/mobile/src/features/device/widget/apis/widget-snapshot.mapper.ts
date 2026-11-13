import type { DateKey } from '@src/shared/date/date-key';
import { type Instant } from '@src/shared/date/instant';
import type { ResolvedLanguage } from '@src/shared/preferences/language.preference';

import type { WidgetDaySnapshot, WidgetSnapshot } from '../schemas/widget-snapshot-storage.schema';
import {
  getWidgetDayState,
  toWidgetSnapshotStrings,
  toWidgetWeek,
  type WidgetTranslateFn,
  type WidgetWeekCompletion,
} from '../utils/widget-snapshot.view-model';

/** todo feature에 의존하지 않도록 GET v1/todos/summary 모델과 같은 모양을 구조적 타입으로 둔다 */
export interface WidgetSummaryInput {
  date: DateKey;
  totalTodos: number;
  completedTodos: number;
  completionRate: number;
  isComplete: boolean;
  currentStreak: number;
  topTodos: readonly {
    id: number;
    title: string;
    completed: boolean;
    categoryColor: string;
  }[];
}

export interface WidgetSnapshotContext {
  t: WidgetTranslateFn;
  locale: ResolvedLanguage;
  now: Instant;
  /** 쓰기 시점의 기기 시간대. 표시 내용이 같아도 바뀌면 iOS timeline의 자정 경계를 다시 써야 한다. */
  timeZone: string;
  weekCompletions?: readonly WidgetWeekCompletion[];
}

export interface WidgetDaySummaries {
  today: WidgetSummaryInput;
  /** 자정 이후 표시할 잠정 요약. 받지 못했으면 생략하고 자정부터 stale을 표시한다. */
  tomorrow?: WidgetSummaryInput;
}

export function toWidgetSnapshot(
  { today, tomorrow }: WidgetDaySummaries,
  context: WidgetSnapshotContext,
): WidgetSnapshot {
  const todaySnapshot = toWidgetDaySnapshot(today, context);
  return {
    version: 2,
    updatedAtIso: context.now,
    days:
      tomorrow == null ? [todaySnapshot] : [todaySnapshot, toWidgetDaySnapshot(tomorrow, context)],
  };
}

function toWidgetDaySnapshot(
  summary: WidgetSummaryInput,
  context: WidgetSnapshotContext,
): WidgetDaySnapshot {
  const topTodos = summary.topTodos.map((todo) => ({
    id: todo.id,
    title: todo.title,
    completed: todo.completed,
    categoryColor: todo.categoryColor,
  }));
  const week = toWidgetWeek(summary, context);

  return {
    state: getWidgetDayState(summary),
    date: summary.date,
    totalTodos: summary.totalTodos,
    completedTodos: summary.completedTodos,
    completionRate: summary.completionRate,
    isComplete: summary.isComplete,
    currentStreak: summary.currentStreak,
    topTodos,
    locale: context.locale,
    weekDays: week.days,
    strings: {
      ...toWidgetSnapshotStrings(context.t, summary),
      weekTitle: week.title,
      weekRangeLabel: week.rangeLabel,
    },
  };
}

export function toLoggedOutWidgetSnapshot(
  localDate: DateKey,
  context: WidgetSnapshotContext,
): WidgetSnapshot {
  return {
    version: 2,
    updatedAtIso: context.now,
    days: [
      {
        state: 'loggedOut',
        date: localDate,
        totalTodos: 0,
        completedTodos: 0,
        completionRate: 0,
        isComplete: false,
        currentStreak: 0,
        topTodos: [],
        locale: context.locale,
        strings: toWidgetSnapshotStrings(context.t, {
          completedTodos: 0,
          totalTodos: 0,
          completionRate: 0,
          currentStreak: 0,
        }),
      },
    ],
  };
}

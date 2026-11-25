import type { SupportedLocale } from '@aido/api/vocabulary';
import type { DateKey } from '@src/shared/date/date-key';
import type { Instant } from '@src/shared/date/instant';

import type {
  StoredWidgetDay,
  StoredWidgetSnapshot,
  StoredWidgetStrings,
} from '../schemas/widget-snapshot-storage.schema';

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

export interface WidgetDaySummaries {
  today: WidgetSummaryInput;
  /** 자정 이후 표시할 잠정 요약. 받지 못했으면 생략하고 자정부터 stale을 표시한다. */
  tomorrow?: WidgetSummaryInput;
}

/** 위젯은 번역하지 못해 쓰기 전에 구워 둔 그날의 문구와 주간 달력이다 */
export interface WidgetDayCopy {
  strings: StoredWidgetStrings;
  week: {
    days: NonNullable<StoredWidgetDay['weekDays']>;
    title: string;
    rangeLabel: string;
  };
}

export function toWidgetDaySnapshot(
  summary: WidgetSummaryInput,
  { strings, week }: WidgetDayCopy,
  locale: SupportedLocale,
): StoredWidgetDay {
  return {
    state: summary.totalTodos > 0 ? 'data' : 'empty',
    date: summary.date,
    totalTodos: summary.totalTodos,
    completedTodos: summary.completedTodos,
    completionRate: summary.completionRate,
    isComplete: summary.isComplete,
    currentStreak: summary.currentStreak,
    topTodos: summary.topTodos.map((todo) => ({
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
      categoryColor: todo.categoryColor,
    })),
    locale,
    weekDays: week.days,
    strings: { ...strings, weekTitle: week.title, weekRangeLabel: week.rangeLabel },
  };
}

export function toLoggedOutWidgetDaySnapshot(
  localDate: DateKey,
  strings: StoredWidgetStrings,
  locale: SupportedLocale,
): StoredWidgetDay {
  return {
    state: 'loggedOut',
    date: localDate,
    totalTodos: 0,
    completedTodos: 0,
    completionRate: 0,
    isComplete: false,
    currentStreak: 0,
    topTodos: [],
    locale,
    strings,
  };
}

export function toWidgetSnapshot(
  days: StoredWidgetSnapshot['days'],
  updatedAt: Instant,
): StoredWidgetSnapshot {
  return { version: 2, updatedAtIso: updatedAt, days };
}

import {
  formatDateKeyLabel,
  toDateFormatLocale,
  type DateFormatContext,
} from '@src/shared/date/date-format';
import { addDaysToDateKey, getCalendarWeek } from '@src/shared/date/date-key';
import type { Instant } from '@src/shared/date/instant';
import type { ResolvedLanguage } from '@src/shared/preferences/language.preference';
import { keyBy, range } from 'es-toolkit';

import { WIDGET_TOP_TODOS_LIMIT } from '../constants/widget.constants';
import type {
  WidgetDaySnapshot,
  WidgetSnapshot,
  WidgetSnapshotStrings,
} from '../schemas/widget-snapshot-storage.schema';

/** todo feature에 의존하지 않도록 GET v1/todos/summary 모델과 같은 모양을 구조적 타입으로 둔다 */
export interface WidgetSummaryInput {
  date: string;
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

/** 매퍼가 요구하는 최소 번역 함수 — i18next `t`가 그대로 만족한다 (순수성/테스트 용이성) */
export type WidgetTranslateFn = (
  key:
    | 'widget:progress.title'
    | 'widget:progress.percent'
    | 'widget:progress.streak'
    | 'widget:progress.compactStreak'
    | 'widget:progress.allDone'
    | 'widget:list.more'
    | 'widget:state.emptyTitle'
    | 'widget:state.emptyCta'
    | 'widget:state.loggedOutTitle'
    | 'widget:state.loggedOutCta'
    | 'widget:state.staleTitle'
    | 'widget:state.staleCta'
    | 'widget:calendar.weekTitle'
    | 'widget:actions.addTodo'
    | 'widget:actions.openTodo',
  params?: Record<string, string | number>,
) => string;

export interface WidgetSnapshotContext {
  t: WidgetTranslateFn;
  locale: ResolvedLanguage;
  now: Instant;
  /** 쓰기 시점의 기기 시간대. 표시 내용이 같아도 바뀌면 iOS timeline의 자정 경계를 다시 써야 한다. */
  timeZone: string;
  userId?: string;
  weekCompletions?: readonly { date: string; totalTodos: number; isComplete: boolean }[];
}

function bakeStrings(
  t: WidgetTranslateFn,
  summary: Pick<
    WidgetSummaryInput,
    'completedTodos' | 'totalTodos' | 'completionRate' | 'currentStreak'
  >,
): WidgetSnapshotStrings {
  return {
    progressTitle: t('widget:progress.title'),
    percentLabel: t('widget:progress.percent', { rate: Math.round(summary.completionRate) }),
    streakLabel: t('widget:progress.streak', { count: summary.currentStreak }),
    compactStreakLabel: t('widget:progress.compactStreak', { count: summary.currentStreak }),
    allDoneLabel: t('widget:progress.allDone'),
    // 표시 행 수는 렌더 시점에 위젯 크기로 정해지므로 카운트는 굽지 않고 위젯이 {count}만 치환한다
    moreLabelTemplate: t('widget:list.more', { overflow: '{count}' }),
    emptyTitle: t('widget:state.emptyTitle'),
    emptyCta: t('widget:state.emptyCta'),
    loggedOutTitle: t('widget:state.loggedOutTitle'),
    loggedOutCta: t('widget:state.loggedOutCta'),
    staleTitle: t('widget:state.staleTitle'),
    staleCta: t('widget:state.staleCta'),
    addTodoLabel: t('widget:actions.addTodo'),
    openTodoLabel: t('widget:actions.openTodo'),
  };
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
  const topTodos = summary.topTodos.slice(0, WIDGET_TOP_TODOS_LIMIT).map((todo) => ({
    id: todo.id,
    title: todo.title,
    completed: todo.completed,
    categoryColor: todo.categoryColor,
  }));
  const week = toWidgetWeek(summary, context);

  return {
    state: summary.totalTodos > 0 ? 'data' : 'empty',
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
      ...bakeStrings(context.t, summary),
      weekTitle: week.title,
      weekRangeLabel: week.rangeLabel,
    },
  };
}

function toWidgetWeek(summary: WidgetSummaryInput, context: WidgetSnapshotContext) {
  const completions = keyBy(context.weekCompletions ?? [], (completion) => completion.date);
  const dateFormatContext: DateFormatContext = {
    locale: toDateFormatLocale(context.locale),
    timeZone: 'UTC',
  };
  const week = getCalendarWeek(summary.date);
  const days = range(7).map((dayOffset) => {
    const date = addDaysToDateKey(week.startDateKey, dayOffset);
    const completion = completions[date];
    return {
      date,
      weekdayLabel: formatDateKeyLabel(date, 'weekday', dateFormatContext),
      dayLabel: formatDateKeyLabel(date, 'dayNumber', dateFormatContext),
      isComplete:
        date === summary.date
          ? summary.isComplete && summary.totalTodos > 0
          : completion?.isComplete === true && completion.totalTodos > 0,
      hasTodos: date === summary.date ? summary.totalTodos > 0 : (completion?.totalTodos ?? 0) > 0,
    };
  });
  const title = context.t('widget:calendar.weekTitle', {
    month: formatDateKeyLabel(week.startDateKey, 'month', dateFormatContext),
    week: week.weekOfMonth,
  });
  const rangeLabel = [week.startDateKey, week.endDateKey]
    .map((dateKey) => formatDateKeyLabel(dateKey, 'dottedMonthDay', dateFormatContext))
    .join(' – ');
  return { days, title, rangeLabel };
}

export function toLoggedOutWidgetSnapshot(
  localDate: string,
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
        strings: bakeStrings(context.t, {
          completedTodos: 0,
          totalTodos: 0,
          completionRate: 0,
          currentStreak: 0,
        }),
      },
    ],
  };
}

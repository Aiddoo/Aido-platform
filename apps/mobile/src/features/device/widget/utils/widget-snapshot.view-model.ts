import { addDaysToDateKey, getCalendarWeek, type DateKey } from '@src/shared/date/date-key';
import { formatDateKeyLabel, type DateFormatContext } from '@src/shared/date/format/date-format';
import { formatWeekHeaderLabel } from '@src/shared/date/format/date-labels';
import { APP_LOCALES } from '@src/shared/i18n/app-locales';
import type { ResolvedLanguage } from '@src/shared/preferences/language.preference';
import { keyBy, range } from 'es-toolkit';

import type { WidgetSnapshotStrings } from '../schemas/widget-snapshot-storage.schema';

/** 스냅샷 문구를 굽는 최소 번역 함수 — i18next `t`가 그대로 만족한다 (순수성/테스트 용이성) */
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
    | 'widget:actions.addTodo'
    | 'widget:actions.openTodo',
  params?: Record<string, string | number>,
) => string;

interface WidgetDayCounts {
  date: DateKey;
  totalTodos: number;
  completedTodos: number;
  completionRate: number;
  isComplete: boolean;
  currentStreak: number;
}

export interface WidgetWeekCompletion {
  date: DateKey;
  totalTodos: number;
  isComplete: boolean;
}

export function getWidgetDayState(summary: Pick<WidgetDayCounts, 'totalTodos'>) {
  return summary.totalTodos > 0 ? ('data' as const) : ('empty' as const);
}

export function toWidgetSnapshotStrings(
  t: WidgetTranslateFn,
  summary: Pick<
    WidgetDayCounts,
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

export function toWidgetWeek(
  summary: Pick<WidgetDayCounts, 'date' | 'totalTodos' | 'isComplete'>,
  {
    locale,
    weekCompletions,
  }: {
    locale: ResolvedLanguage;
    weekCompletions?: readonly WidgetWeekCompletion[];
  },
) {
  const completions = keyBy(weekCompletions ?? [], (completion) => completion.date);
  const dateFormatContext: DateFormatContext = {
    locale: APP_LOCALES[locale].intlLocale,
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
  // 위젯은 늘 이번 주라 연도를 붙이지 않는다
  const title = formatWeekHeaderLabel(
    { monthDateKey: week.middleDateKey, weekOfMonth: week.weekOfMonth, hasYear: false },
    dateFormatContext,
  );
  const rangeLabel = [week.startDateKey, week.endDateKey]
    .map((dateKey) => formatDateKeyLabel(dateKey, 'dottedMonthDay', dateFormatContext))
    .join(' – ');
  return { days, title, rangeLabel };
}

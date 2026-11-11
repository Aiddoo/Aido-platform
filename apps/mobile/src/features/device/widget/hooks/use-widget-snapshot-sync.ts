import { useWidgetSyncService } from '@src/bootstrap/providers/di-context';
import { useGetMeQueryOptions } from '@src/features/identity/user/queries/user.queries';
import {
  useGetDailyCompletionsQueryOptions,
  useGetTodoSummaryQueryOptions,
} from '@src/features/planning/todo/queries/todo.queries';
import { getNowInstant } from '@src/shared/date/clock';
import { addDaysToDateKey, getCalendarWeek } from '@src/shared/date/date-key';
import { i18n } from '@src/shared/i18n';
import { toResolvedLanguage } from '@src/shared/preferences/language.preference';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';

import type { WidgetSnapshotContext, WidgetSummaryInput } from '../apis/widget-snapshot.mapper';
import type { WidgetSyncService } from '../apis/widget-sync.service';
import type { WidgetTranslateFn } from '../utils/widget-snapshot.view-model';

export type WidgetSyncAuthState = 'authenticated' | 'unauthenticated' | 'resolving';

function translate(...[key, params]: Parameters<WidgetTranslateFn>): ReturnType<WidgetTranslateFn> {
  return i18n.t(key, params ?? {});
}

function buildContext(
  timeZone: string,
  weekCompletions?: WidgetSnapshotContext['weekCompletions'],
  userId?: string,
): WidgetSnapshotContext {
  return {
    t: translate,
    locale: toResolvedLanguage(i18n.language),
    now: getNowInstant(),
    timeZone,
    weekCompletions,
    userId,
  };
}

interface LatestWidgetSnapshot {
  authState: WidgetSyncAuthState;
  userId?: string;
  date: string;
  timeZone: string;
  tomorrowDate: string;
  data?: WidgetSummaryInput;
  tomorrowData?: WidgetSummaryInput;
  completions?: Record<string, NonNullable<WidgetSnapshotContext['weekCompletions']>[number]>;
}

function syncLatest(widgetSyncService: WidgetSyncService, latest: LatestWidgetSnapshot): void {
  if (latest.authState === 'unauthenticated') {
    widgetSyncService.syncLoggedOut(latest.date, buildContext(latest.timeZone));
    return;
  }
  if (
    latest.authState === 'authenticated' &&
    latest.userId != null &&
    latest.data?.date === latest.date
  ) {
    widgetSyncService.syncSummary(
      {
        today: latest.data,
        // 서버가 아직 같은 날짜를 돌려주지 않으면 내일 day 없이 쓰고 자정부터 stale을 보인다.
        tomorrow:
          latest.tomorrowData?.date === latest.tomorrowDate ? latest.tomorrowData : undefined,
      },
      buildContext(
        latest.timeZone,
        latest.completions ? Object.values(latest.completions) : undefined,
        latest.userId,
      ),
    );
  }
}

export function useWidgetSnapshotSync(authState: WidgetSyncAuthState): void {
  const widgetSyncService = useWidgetSyncService();
  const { currentLocalDateKey: date, currentTimeZone } = useLocalDate();
  const { startDateKey: rangeStart, endDateKey: rangeEnd } = getCalendarWeek(date);
  const { data: user } = useQuery({
    ...useGetMeQueryOptions(),
    enabled: authState === 'authenticated',
    throwOnError: false,
  });
  const userId = user?.id;
  const tomorrowDate = addDaysToDateKey(date, 1);
  const isUserDataEnabled = authState === 'authenticated' && userId != null;
  const todayQueryOptions = useGetTodoSummaryQueryOptions({ date, userId });
  const tomorrowQueryOptions = useGetTodoSummaryQueryOptions({
    date: tomorrowDate,
    userId,
  });
  const [{ data }, { data: tomorrowData }] = useQueries({
    queries: [
      { ...todayQueryOptions, enabled: isUserDataEnabled, throwOnError: false },
      { ...tomorrowQueryOptions, enabled: isUserDataEnabled, throwOnError: false },
    ],
  });
  const { data: completions } = useQuery({
    ...useGetDailyCompletionsQueryOptions({ startDate: rangeStart, endDate: rangeEnd }),
    enabled: isUserDataEnabled,
    throwOnError: false,
  });

  const syncCurrent = useEffectEvent(() => {
    syncLatest(widgetSyncService, {
      authState,
      userId,
      date,
      timeZone: currentTimeZone,
      tomorrowDate,
      data,
      tomorrowData,
      completions,
    });
  });

  useEffect(() => {
    syncCurrent();
  }, [authState, data, tomorrowData, completions, date, tomorrowDate, currentTimeZone, userId]);

  useEffect(() => {
    const handleLanguageChanged = () => {
      syncCurrent();
    };

    i18n.on('languageChanged', handleLanguageChanged);
    return () => i18n.off('languageChanged', handleLanguageChanged);
  }, []);
}

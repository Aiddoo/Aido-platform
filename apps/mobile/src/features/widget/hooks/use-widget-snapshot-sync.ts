import { useWidgetSyncService } from '@src/bootstrap/providers/di-context';
import { useGetDailyCompletionsQueryOptions } from '@src/features/todo/queries/get-daily-completions-query-options';
import { useGetTodoSummaryQueryOptions } from '@src/features/todo/queries/get-todo-summary-query-options';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { i18n } from '@src/shared/i18n';
import { toResolvedLanguage } from '@src/shared/preferences/language.preference';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { getWeekRange } from '@src/shared/utils/date';
import { getNextDateKey } from '@src/shared/utils/local-date-clock';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type {
  WidgetSnapshotContext,
  WidgetSummaryInput,
  WidgetTranslateFn,
} from '../apis/widget-snapshot.mapper';
import type { WidgetSyncService } from '../apis/widget-sync.service';

export type WidgetSyncAuthState = 'authenticated' | 'unauthenticated' | 'resolving';

const translate: WidgetTranslateFn = (key, params) => i18n.t(key, params);

function buildContext(
  weekCompletions?: WidgetSnapshotContext['weekCompletions'],
  userId?: string,
): WidgetSnapshotContext {
  return {
    t: translate,
    locale: toResolvedLanguage(i18n.language),
    now: new Date(),
    weekCompletions,
    userId,
  };
}

interface LatestWidgetSnapshot {
  authState: WidgetSyncAuthState;
  userId?: string;
  date: string;
  tomorrowDate: string;
  data?: WidgetSummaryInput;
  tomorrowData?: WidgetSummaryInput;
  completions?: Record<string, NonNullable<WidgetSnapshotContext['weekCompletions']>[number]>;
}

function syncLatest(widgetSyncService: WidgetSyncService, latest: LatestWidgetSnapshot): void {
  if (latest.authState === 'unauthenticated') {
    widgetSyncService.syncLoggedOut(latest.date, buildContext());
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
        latest.completions ? Object.values(latest.completions) : undefined,
        latest.userId,
      ),
    );
  }
}

export function useWidgetSnapshotSync(authState: WidgetSyncAuthState): void {
  const widgetSyncService = useWidgetSyncService();
  const {
    currentLocalDate,
    currentLocalDateKey: date,
    currentTimeZone,
    currentUtcOffsetMinutes,
  } = useLocalDate();
  const { rangeStart, rangeEnd } = getWeekRange(currentLocalDate);
  const { data: user } = useQuery({
    ...useGetMeQueryOptions(),
    enabled: authState === 'authenticated',
    throwOnError: false,
  });
  const userId = user?.id;
  const tomorrowDate = getNextDateKey(date);
  const isUserDataEnabled = authState === 'authenticated' && userId != null;
  const todayQueryOptions = useGetTodoSummaryQueryOptions({ date, todayDate: date, userId });
  const tomorrowQueryOptions = useGetTodoSummaryQueryOptions({
    date: tomorrowDate,
    todayDate: date,
    userId,
  });
  const [{ data }, { data: tomorrowData }] = useQueries({
    queries: [
      { ...todayQueryOptions, enabled: isUserDataEnabled, throwOnError: false },
      { ...tomorrowQueryOptions, enabled: isUserDataEnabled, throwOnError: false },
    ],
  });
  const { data: completions } = useQuery({
    ...useGetDailyCompletionsQueryOptions({ startDate: rangeStart, endDate: rangeEnd, userId }),
    enabled: isUserDataEnabled,
    throwOnError: false,
  });

  useEffect(() => {
    syncLatest(widgetSyncService, {
      authState,
      userId,
      date,
      tomorrowDate,
      data,
      tomorrowData,
      completions,
    });
  }, [
    authState,
    data,
    tomorrowData,
    completions,
    date,
    tomorrowDate,
    currentTimeZone,
    currentUtcOffsetMinutes,
    userId,
    widgetSyncService,
  ]);

  const latestRef = useRef<LatestWidgetSnapshot>({
    data,
    tomorrowData,
    completions,
    authState,
    userId,
    date,
    tomorrowDate,
  });
  useEffect(() => {
    latestRef.current = { data, tomorrowData, completions, authState, userId, date, tomorrowDate };
  }, [data, tomorrowData, completions, authState, userId, date, tomorrowDate]);

  useEffect(() => {
    const handleLanguageChanged = () => {
      syncLatest(widgetSyncService, latestRef.current);
    };

    i18n.on('languageChanged', handleLanguageChanged);
    return () => i18n.off('languageChanged', handleLanguageChanged);
  }, [widgetSyncService]);
}

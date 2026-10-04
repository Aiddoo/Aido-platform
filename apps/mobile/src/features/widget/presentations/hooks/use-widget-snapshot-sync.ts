import { useWidgetSyncService } from '@src/bootstrap/providers/di-context';
import { useGetDailyCompletionsQueryOptions } from '@src/features/todo/presentations/queries/get-daily-completions-query-options';
import { useGetTodoSummaryQueryOptions } from '@src/features/todo/presentations/queries/get-todo-summary-query-options';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { i18n } from '@src/shared/i18n';
import { toResolvedLanguage } from '@src/shared/preferences/language.preference';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { getWeekRange } from '@src/shared/utils/date';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type {
  WidgetSnapshotContext,
  WidgetTranslateFn,
} from '../../services/widget-snapshot.mapper';

export type WidgetSyncAuthState = 'authenticated' | 'unauthenticated' | 'resolving';

const translate: WidgetTranslateFn = (key, params) => i18n.t(key, params);

function buildContext(
  weekCompletions?: WidgetSnapshotContext['weekCompletions'],
): WidgetSnapshotContext {
  return {
    t: translate,
    locale: toResolvedLanguage(i18n.language),
    now: new Date(),
    weekCompletions,
  };
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
  const summaryOptions = useGetTodoSummaryQueryOptions(date, userId);
  const { data } = useQuery({
    ...summaryOptions,
    enabled: authState === 'authenticated' && userId != null,
    throwOnError: false,
  });
  const { data: completions } = useQuery({
    ...useGetDailyCompletionsQueryOptions(rangeStart, rangeEnd, userId),
    enabled: authState === 'authenticated' && userId != null,
    throwOnError: false,
  });

  useEffect(() => {
    if (authState === 'unauthenticated') {
      void widgetSyncService.syncLoggedOut(date, buildContext());
      return;
    }
    if (authState === 'authenticated' && userId != null && data?.date === date) {
      void widgetSyncService.syncSummary(
        data,
        buildContext(completions ? Object.values(completions) : undefined),
      );
    }
  }, [
    authState,
    data,
    completions,
    date,
    currentTimeZone,
    currentUtcOffsetMinutes,
    userId,
    widgetSyncService,
  ]);

  const latestRef = useRef({ data, completions, authState, userId, date });
  useEffect(() => {
    latestRef.current = { data, completions, authState, userId, date };
  }, [data, completions, authState, userId, date]);

  useEffect(() => {
    const handleLanguageChanged = () => {
      const latest = latestRef.current;
      if (latest.authState === 'unauthenticated') {
        void widgetSyncService.syncLoggedOut(latest.date, buildContext());
        return;
      }
      if (
        latest.authState === 'authenticated' &&
        latest.userId != null &&
        latest.data?.date === latest.date
      ) {
        void widgetSyncService.syncSummary(
          latest.data,
          buildContext(latest.completions ? Object.values(latest.completions) : undefined),
        );
      }
    };

    i18n.on('languageChanged', handleLanguageChanged);
    return () => i18n.off('languageChanged', handleLanguageChanged);
  }, [widgetSyncService]);
}

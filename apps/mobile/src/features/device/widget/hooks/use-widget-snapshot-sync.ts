import { useErrorReporter, useWidgetSyncService } from '@src/bootstrap/providers/di-context';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import { useMyAccountId } from '@src/features/identity/user/hooks/use-my-account-id';
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
import { noop } from 'es-toolkit';
import { useEffect, useEffectEvent } from 'react';
import { match } from 'ts-pattern';

import type { WidgetSnapshotContext, WidgetSummaryInput } from '../apis/widget-snapshot.mapper';
import { WIDGET_TOP_TODOS_LIMIT } from '../constants/widget.constants';
import type { WidgetSyncResult, WidgetSyncService } from '../services/widget-sync.service';
import type { WidgetTranslateFn } from '../utils/widget-snapshot.view-model';

export type WidgetSyncAuthState = 'authenticated' | 'unauthenticated' | 'resolving';

function translate(...[key, params]: Parameters<WidgetTranslateFn>): ReturnType<WidgetTranslateFn> {
  return i18n.t(key, params ?? {});
}

function buildContext(
  timeZone: string,
  weekCompletions?: WidgetSnapshotContext['weekCompletions'],
): WidgetSnapshotContext {
  return {
    t: translate,
    locale: toResolvedLanguage(i18n.language),
    now: getNowInstant(),
    timeZone,
    weekCompletions,
  };
}

interface LatestWidgetSnapshot {
  authState: WidgetSyncAuthState;
  userId: string | null;
  date: string;
  timeZone: string;
  tomorrowDate: string;
  data?: WidgetSummaryInput;
  tomorrowData?: WidgetSummaryInput;
  completions?: Record<string, NonNullable<WidgetSnapshotContext['weekCompletions']>[number]>;
}

type WidgetSyncMethod = 'syncSummary' | 'syncLoggedOut';

function syncLatest(
  widgetSyncService: WidgetSyncService,
  latest: LatestWidgetSnapshot,
): { method: WidgetSyncMethod; result: Promise<WidgetSyncResult> } | null {
  if (latest.authState === 'unauthenticated') {
    return {
      method: 'syncLoggedOut',
      result: widgetSyncService.syncLoggedOut(latest.date, buildContext(latest.timeZone)),
    };
  }
  if (
    latest.authState !== 'authenticated' ||
    latest.userId == null ||
    latest.data?.date !== latest.date
  ) {
    return null;
  }
  return {
    method: 'syncSummary',
    result: widgetSyncService.syncSummary(
      {
        today: latest.data,
        // 서버가 아직 같은 날짜를 돌려주지 않으면 내일 day 없이 쓰고 자정부터 stale을 보인다.
        tomorrow:
          latest.tomorrowData?.date === latest.tomorrowDate ? latest.tomorrowData : undefined,
      },
      buildContext(
        latest.timeZone,
        latest.completions ? Object.values(latest.completions) : undefined,
      ),
      latest.userId,
    ),
  };
}

function reportWidgetSync(
  errorReporter: ErrorReporter,
  method: WidgetSyncMethod,
  result: WidgetSyncResult,
): void {
  match(result)
    .with({ status: 'written' }, ({ snapshot: { days } }) =>
      errorReporter.addBreadcrumb({
        category: 'widget',
        message: 'widget snapshot synced',
        data: {
          date: days[0].date,
          state: days[0].state,
          total: days[0].totalTodos,
          dayCount: days.length,
        },
      }),
    )
    .with({ status: 'failed' }, ({ error }) =>
      errorReporter.captureException(error, { feature: 'widget', method }),
    )
    .with({ status: 'unchanged' }, { status: 'superseded' }, noop)
    .exhaustive();
}

export function useWidgetSnapshotSync(authState: WidgetSyncAuthState): void {
  const widgetSyncService = useWidgetSyncService();
  const errorReporter = useErrorReporter();
  const { currentLocalDateKey: date, currentTimeZone } = useLocalDate();
  const { startDateKey: rangeStart, endDateKey: rangeEnd } = getCalendarWeek(date);
  const userId = useMyAccountId({ isEnabled: authState === 'authenticated' });
  const tomorrowDate = addDaysToDateKey(date, 1);
  const isUserDataEnabled = userId != null;
  const todayQueryOptions = useGetTodoSummaryQueryOptions({
    date,
    userId,
    limit: WIDGET_TOP_TODOS_LIMIT,
  });
  const tomorrowQueryOptions = useGetTodoSummaryQueryOptions({
    date: tomorrowDate,
    userId,
    limit: WIDGET_TOP_TODOS_LIMIT,
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
    const sync = syncLatest(widgetSyncService, {
      authState,
      userId,
      date,
      timeZone: currentTimeZone,
      tomorrowDate,
      data,
      tomorrowData,
      completions,
    });
    // 위젯·관측 실패가 인증 흐름으로 번지지 않게 보고 실패도 삼킨다
    sync?.result.then((result) => reportWidgetSync(errorReporter, sync.method, result)).catch(noop);
  });

  // 앱 없이 깨어난 Android 위젯의 실패는 Sentry를 부를 수 없어 저장해 두었다가 다음 시작에 보낸다
  useEffect(() => {
    const failure = widgetSyncService.takeHeadlessFailure();
    if (failure == null) {
      return;
    }
    try {
      errorReporter.captureException(failure.error, { feature: 'widget', method: failure.method });
    } catch {
      // 관측 실패가 앱 시작을 막지 않는다
    }
  }, [widgetSyncService, errorReporter]);

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

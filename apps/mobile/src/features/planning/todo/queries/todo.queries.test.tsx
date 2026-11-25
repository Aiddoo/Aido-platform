import { ok } from '@src/core/errors/result';
import { getWeeklyRecordRange } from '@src/features/insights/report/utils/weekly-record.view-model';
import { FORECAST_DAYS } from '@src/features/weather/constants/weather.constants';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import {
  addDaysToDateKey,
  diffDateKeysInDays,
  getCalendarWeek,
  type DateKey,
} from '@src/shared/date/date-key';
import { createHttpClientStub, createTestDi, createTestQueryClient } from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreenHook } from '@src/testing/render';
import { useQueries } from '@tanstack/react-query';
import { waitFor } from '@testing-library/react-native';
import { range } from 'es-toolkit';

import { createDailyCompletionsDto } from '../__tests__/todo.fixtures';
import type { DailyCompletionRange } from '../domains/daily-completion.model';
import { useCalendarCompletions } from '../hooks/use-calendar-completions';
import { useGetDailyCompletionsInRangeQueriesOptions } from './todo.queries';

const COMPLETIONS_PATH = 'v1/daily-completions';

function listDates({ startDate, endDate }: DailyCompletionRange): DateKey[] {
  return range(diffDateKeysInDays(startDate, endDate) + 1).map((offset) =>
    addDaysToDateKey(startDate, offset),
  );
}

/** 그날의 할 일 수가 날짜(일)인 서버. 어느 범위로 물어도 같은 날은 같은 값이다 */
function createCompletionServer() {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async (_url, options) => {
    const requested = {
      startDate: createDateKey(String(options?.params?.startDate)),
      endDate: createDateKey(String(options?.params?.endDate)),
    };
    return ok(
      createDailyCompletionsDto({
        completions: listDates(requested).map((date) => ({
          date,
          totalTodos: Number(date.slice(-2)),
          completedTodos: 0,
          isComplete: false,
          completionRate: 0,
          categoryColors: ['#FF6B43'],
        })),
        totalCompleteDays: 0,
        dateRange: requested,
      }),
    );
  });
  return httpClient;
}

/** 서버가 그 기간만 물었을 때 돌려준 값 — 기간 키로 따로 받던 때 화면이 보던 값이다 */
function expectedDays(dateRange: DailyCompletionRange) {
  return Object.fromEntries(
    listDates(dateRange).map((date) => [
      date,
      expect.objectContaining({ date, totalTodos: Number(date.slice(-2)) }),
    ]),
  );
}

describe('완료 기록 조회', () => {
  it.each(['2026-11-25', '2026-11-30', '2027-07-30'])(
    '오늘이 %s일 때 위젯·달력·이번 주 기록·날씨를 차례로 열어도 달 키 세 개(앞·이번·다음 달)로 한 번씩만 묻고 각자 보던 날만 본다',
    async (today) => {
      // Given
      const httpClient = createCompletionServer();
      // 앱 QueryClient처럼 받은 값을 5분 동안 새것으로 본다
      const queryClient = createTestQueryClient({
        defaultOptions: { queries: { staleTime: 5 * MINUTE_MS } },
      });
      const di = createTestDi({ ports: { httpClient, queryClient } });
      const todayKey = createDateKey(today);
      const week = getCalendarWeek(todayKey);
      const widgetRange = { startDate: week.startDateKey, endDate: week.endDateKey };
      const weeklyRange = getWeeklyRecordRange(todayKey);
      const forecastRange = {
        startDate: todayKey,
        endDate: addDaysToDateKey(todayKey, FORECAST_DAYS - 1),
      };
      const renderRange = (dateRange: DailyCompletionRange) =>
        renderScreenHook(() => useQueries(useGetDailyCompletionsInRangeQueriesOptions(dateRange)), {
          di,
        });

      // When
      const widget = await renderRange(widgetRange);
      const calendar = await renderScreenHook(() => useCalendarCompletions({ dateKey: todayKey }), {
        di,
      });
      await waitFor(() =>
        expect(Object.keys(calendar.result.current.completions)).not.toHaveLength(0),
      );
      await waitFor(() => expect(httpClient.get).toHaveBeenCalledTimes(3));
      const weekly = await renderRange(weeklyRange);
      const forecast = await renderRange(forecastRange);
      await waitFor(() => expect(forecast.result.current).toBeDefined());
      await waitFor(() => expect(weekly.result.current).toBeDefined());

      // Then
      expect(httpClient.get.mock.calls.map(([url]) => url)).toEqual(
        Array.from({ length: 3 }, () => COMPLETIONS_PATH),
      );
      expect(widget.result.current).toEqual(expectedDays(widgetRange));
      expect(weekly.result.current).toEqual(expectedDays(weeklyRange));
      expect(forecast.result.current).toEqual(expectedDays(forecastRange));
    },
  );
});

import { ErrorCode } from '@aido/api/errors';
import { err, ok } from '@src/core/errors/result';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { addDaysToDateKey, getMonthStartDateKey, type DateKey } from '@src/shared/date/date-key';
import { createHttpClientStub, createTestQueryClient } from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreenHook } from '@src/testing/render';
import { act, waitFor } from '@testing-library/react-native';

import { createDailyCompletionsDto, createTodoApiError } from '../__tests__/todo.fixtures';
import {
  getTodoSummaryRefetchInterval,
  shouldPersistTodosByDate,
  useCalendarCompletions,
  useFriendCalendarCompletions,
} from './todo.queries';

describe('shouldPersistTodosByDate', () => {
  const todayKey = createDateKey('2026-11-03');

  it.each(['2026-11-02', '2026-11-03', '2026-11-04'])('%s 목록은 기기에 남긴다', (date) => {
    // When
    const result = shouldPersistTodosByDate({ date: createDateKey(date), todayKey: todayKey });

    // Then
    expect(result).toBe(true);
  });

  it.each(['2026-11-01', '2026-11-05', '2026-10-03'])('%s 목록은 남기지 않는다', (date) => {
    // When
    const result = shouldPersistTodosByDate({ date: createDateKey(date), todayKey: todayKey });

    // Then
    expect(result).toBe(false);
  });

  it('달이 바뀌는 날에도 앞뒤 하루를 남긴다', () => {
    // When
    const monthEnd = shouldPersistTodosByDate({
      date: createDateKey('2026-10-31'),
      todayKey: createDateKey('2026-11-01'),
    });
    const yearEnd = shouldPersistTodosByDate({
      date: createDateKey('2027-01-01'),
      todayKey: createDateKey('2026-12-31'),
    });

    // Then
    expect(monthEnd).toBe(true);
    expect(yearEnd).toBe(true);
  });
});

describe('getTodoSummaryRefetchInterval', () => {
  const success = (responseDate: string, dataUpdateCount = 1) =>
    ({
      data: { date: createDateKey(responseDate) },
      status: 'success',
      dataUpdateCount,
      errorUpdateCount: 0,
    }) as const;

  it('오늘 요청에 전날 요약이 오면 서버가 날짜를 따라잡을 때까지 짧게 다시 묻는다', () => {
    // Given
    const state = success('2026-07-12');

    // When
    const interval = getTodoSummaryRefetchInterval(state, createDateKey('2026-07-13'));

    // Then
    expect(interval).toBe(5_000);
  });

  it('요청한 날짜의 요약이 오면 다시 묻지 않는다', () => {
    // Given
    const state = success('2026-07-13');

    // When
    const interval = getTodoSummaryRefetchInterval(state, createDateKey('2026-07-13'));

    // Then
    expect(interval).toBe(false);
  });

  it('따라잡지 못한 채 네 번 물었으면 더 묻지 않는다', () => {
    // Given
    const state = success('2026-07-12', 5);

    // When
    const interval = getTodoSummaryRefetchInterval(state, createDateKey('2026-07-13'));

    // Then
    expect(interval).toBe(false);
  });
});

const MARCH_DOT = createDateKey('2026-03-15');
const APRIL_DOT = createDateKey('2026-04-15');
const MAY_DOT = createDateKey('2026-05-15');

/** 달 범위마다 그 달 15일에 점 하나를 돌려주는 서버 */
function createCalendarServer() {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async (_url, options) => {
    const startDate = String(options?.params?.startDate);
    const endDate = String(options?.params?.endDate);
    // 범위의 첫 주는 앞 달 끝일 수 있어 한 주 뒤의 달이 그 범위의 달이다
    const dotDate = addDaysToDateKey(
      getMonthStartDateKey(addDaysToDateKey(createDateKey(startDate), 7)),
      14,
    );
    return ok(
      createDailyCompletionsDto({
        completions: [
          {
            date: dotDate,
            totalTodos: 1,
            completedTodos: 0,
            isComplete: false,
            completionRate: 0,
            categoryColors: ['#FF6B43'],
          },
        ],
        dateRange: { startDate, endDate },
      }),
    );
  });
  return httpClient;
}

/** 앱 QueryClient처럼 받은 값을 5분 동안 새것으로 본다. 옵저버가 바뀌어도 다시 받지 않는다 */
function createAppLikeQueryClient() {
  return createTestQueryClient({ defaultOptions: { queries: { staleTime: 5 * MINUTE_MS } } });
}

describe('useCalendarCompletions', () => {
  it('처음 열면 고른 달 하나만 묻고, 받은 뒤 앞뒤 달을 묻는다', async () => {
    // Given
    const httpClient = createCalendarServer();

    // When
    await renderScreenHook(() => useCalendarCompletions({ dateKey: createDateKey('2026-03-10') }), {
      di: { httpClient },
      queryClient: createAppLikeQueryClient(),
    });
    const firstRequest = httpClient.get.mock.calls.at(0);
    await waitFor(() => expect(httpClient.get).toHaveBeenCalledTimes(3));

    // Then
    expect(firstRequest?.[1]?.params).toMatchObject({
      startDate: '2026-03-01',
      endDate: '2026-04-04',
    });
  });

  it('받아 둔 다음 달로 넘기면 첫 프레임부터 그 달 점이 있고 새로 받는 건 그다음 달 하나다', async () => {
    // Given
    const httpClient = createCalendarServer();
    const selection = { dateKey: createDateKey('2026-03-10') };
    const frames: { dateKey: DateKey; dots: string[] }[] = [];
    const { rerender } = await renderScreenHook(
      () => {
        const calendar = useCalendarCompletions(selection);
        frames.push({ dateKey: selection.dateKey, dots: Object.keys(calendar.completions) });
        return calendar;
      },
      { di: { httpClient }, queryClient: createAppLikeQueryClient() },
    );
    await waitFor(() => expect(frames.at(-1)?.dots).toContain(APRIL_DOT));
    const requestsBeforeMove = httpClient.get.mock.calls.length;

    // When
    selection.dateKey = createDateKey('2026-04-10');
    await act(() => rerender({}));
    await waitFor(() => expect(frames.at(-1)?.dots).toContain(MAY_DOT));

    // Then
    const aprilFrames = frames.filter(({ dateKey }) => dateKey === '2026-04-10');
    expect(aprilFrames.every(({ dots }) => dots.includes(APRIL_DOT))).toBe(true);
    expect(aprilFrames.every(({ dots }) => dots.includes(MARCH_DOT))).toBe(true);
    expect(httpClient.get.mock.calls.length - requestsBeforeMove).toBe(1);
  });
});

describe('useFriendCalendarCompletions', () => {
  it('볼 수 없는 친구면 고른 달 하나만 실패하고 앞뒤 달은 묻지 않는다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue(
      err(createTodoApiError({ code: ErrorCode.FOLLOW_0906, status: 403 })),
    );

    // When
    const { result } = await renderScreenHook(
      () =>
        useFriendCalendarCompletions({
          friendUserId: 'friend-1',
          dateKey: createDateKey('2026-03-10'),
        }),
      { di: { httpClient }, queryClient: createAppLikeQueryClient() },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));

    // Then
    expect(httpClient.get).toHaveBeenCalledTimes(1);
  });
});

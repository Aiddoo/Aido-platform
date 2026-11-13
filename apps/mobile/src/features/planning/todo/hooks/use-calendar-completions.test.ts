import { ok } from '@src/core/errors/result';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { addDaysToDateKey, getMonthStartDateKey, type DateKey } from '@src/shared/date/date-key';
import { createHttpClientStub, createTestQueryClient, createTestDi } from '@src/testing/core';
import { createDateKey } from '@src/testing/date-key';
import { renderScreenHook } from '@src/testing/render';
import { act, waitFor } from '@testing-library/react-native';

import { createDailyCompletionsDto } from '../__tests__/todo.fixtures';
import { useCalendarCompletions } from './use-calendar-completions';

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
      di: createTestDi({ ports: { httpClient, queryClient: createAppLikeQueryClient() } }),
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
      { di: createTestDi({ ports: { httpClient, queryClient: createAppLikeQueryClient() } }) },
    );
    await waitFor(() => expect(frames.at(-1)?.dots).toContain(APRIL_DOT));
    const requestsBeforeMove = httpClient.get.mock.calls.length;

    // When
    selection.dateKey = createDateKey('2026-04-10');
    await act(() => rerender(undefined));
    await waitFor(() => expect(frames.at(-1)?.dots).toContain(MAY_DOT));

    // Then
    const aprilFrames = frames.filter(({ dateKey }) => dateKey === '2026-04-10');
    expect(aprilFrames.every(({ dots }) => dots.includes(APRIL_DOT))).toBe(true);
    expect(aprilFrames.every(({ dots }) => dots.includes(MARCH_DOT))).toBe(true);
    expect(httpClient.get.mock.calls.length - requestsBeforeMove).toBe(1);
  });
});

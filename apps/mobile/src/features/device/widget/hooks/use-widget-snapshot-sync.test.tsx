import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result } from '@src/core/errors/result';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { createDailyCompletionsDto } from '@src/features/planning/todo/__tests__/todo.fixtures';
import { invalidateWidgetSummary } from '@src/features/planning/todo/queries/todo-cache';
import { DAY_MS } from '@src/shared/constants/time-units';
import { addDaysToDateKey, dateKeySchema } from '@src/shared/date/date-key';
import { i18n } from '@src/shared/i18n';
import { writeStoredValue } from '@src/shared/storage/define-stored-value';
import {
  createErrorReporterStub,
  createHttpClientStub,
  createMemoryObservableSyncStorage,
  createPendingResponse,
  createTestQueryClient,
  createTestDi,
  createWidgetBridgeStub,
  setupFakeTimersPerTest,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { act, waitFor } from '@testing-library/react-native';

import { widgetHeadlessFailureStoredValue } from '../schemas/widget-headless-failure-storage.schema';
import { useWidgetSnapshotSync, type WidgetSyncAuthState } from './use-widget-snapshot-sync';

const ACCOUNT_ID = 'account-a';
const SERVER_LAGGING_DAYS = -1;
// 서버 날짜를 따라잡는 첫 간격 재조회(todo-cache의 5s)
const DATE_CATCH_UP_FIRST_DELAY_MS = 5_000;

function createSummaryDto(date: unknown) {
  return {
    date,
    totalTodos: 1,
    completedTodos: 0,
    completionRate: 0,
    isComplete: false,
    currentStreak: 0,
    topTodos: [{ id: 1, title: '앞 계정의 할 일', completed: false, categoryColor: '#FFB3B3' }],
  };
}

async function renderSync({
  authState,
  getSummary = async (date) => ok(createSummaryDto(date)),
  widgetBridge = createWidgetBridgeStub(),
}: {
  authState: WidgetSyncAuthState;
  getSummary?: (date: unknown) => Promise<Result<unknown, ApiError>>;
  widgetBridge?: ReturnType<typeof createWidgetBridgeStub>;
}) {
  const httpClient = createHttpClientStub();
  httpClient.get.mockImplementation(async (url, options) => {
    if (url === 'v1/todos/summary') {
      return getSummary(options?.params?.date);
    }
    return ok(createDailyCompletionsDto());
  });
  const errorReporter = createErrorReporterStub();
  const widgetStorage = createMemoryObservableSyncStorage();
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: ACCOUNT_ID }));
  const current = { authState };
  const hook = await renderScreenHook(() => useWidgetSnapshotSync(current.authState), {
    di: createTestDi({
      ports: { httpClient, widgetBridge, errorReporter, widgetStorage, queryClient },
    }),
    withLocalDate: true,
  });

  return {
    httpClient,
    queryClient,
    widgetBridge,
    errorReporter,
    widgetStorage,
    changeAuthState: async (next: WidgetSyncAuthState) => {
      current.authState = next;
      await hook.rerender(undefined);
    },
    writtenStates: () =>
      widgetBridge.writeSnapshot.mock.calls.map(([snapshot, userId]) => ({
        state: snapshot.days[0].state,
        userId,
      })),
  };
}

function requestedSummaryDates(httpClient: ReturnType<typeof createHttpClientStub>) {
  return httpClient.get.mock.calls.flatMap(([url, options]) =>
    url === 'v1/todos/summary' ? [options?.params?.date] : [],
  );
}

describe('useWidgetSnapshotSync', () => {
  describe('자정을 넘긴 뒤 날짜가 아직 바뀌지 않은 재조회', () => {
    setupFakeTimersPerTest({ now: new Date('2026-11-23T03:00:00.000Z') });

    it('기기 시계로 이미 지난 날짜의 요약은 서버에 묻지 않고 새 오늘만 다시 묻는다', async () => {
      // Given
      const { httpClient, queryClient } = await renderSync({ authState: 'authenticated' });
      await waitFor(() => expect(requestedSummaryDates(httpClient)).toHaveLength(2));
      const [staleToday, newToday] = requestedSummaryDates(httpClient);
      httpClient.get.mockClear();
      jest.setSystemTime(Date.now() + DAY_MS);

      // When
      await act(() => invalidateWidgetSummary(queryClient));

      // Then
      expect(requestedSummaryDates(httpClient)).toEqual([newToday]);
      expect(staleToday).not.toBe(newToday);
    });

    it('서버 날짜를 따라잡는 간격 재조회도 기기 시계로 이미 지난 날짜는 서버에 묻지 않는다', async () => {
      // Given
      const { httpClient } = await renderSync({
        authState: 'authenticated',
        getSummary: async (date) =>
          ok(createSummaryDto(addDaysToDateKey(dateKeySchema.parse(date), SERVER_LAGGING_DAYS))),
      });
      await waitFor(() => expect(requestedSummaryDates(httpClient)).toHaveLength(2));
      const [staleToday, newToday] = requestedSummaryDates(httpClient);
      httpClient.get.mockClear();
      jest.setSystemTime(Date.now() + DAY_MS);

      // When
      await act(() => jest.advanceTimersByTimeAsync(DATE_CATCH_UP_FIRST_DELAY_MS));

      // Then
      expect(requestedSummaryDates(httpClient)).toEqual([newToday]);
      expect(staleToday).not.toBe(newToday);
    });
  });

  describe('다시 쓰는 때', () => {
    setupFakeTimersPerTest({ now: new Date('2026-11-23T03:00:00.000Z') });

    afterEach(async () => {
      await act(() => i18n.changeLanguage('ko'));
    });

    async function renderSyncedOnce() {
      const summary = { title: '처음 할 일' };
      const rendered = await renderSync({
        authState: 'authenticated',
        getSummary: async (date) =>
          ok({
            ...createSummaryDto(date),
            topTodos: [{ id: 1, title: summary.title, completed: false, categoryColor: '#FFB3B3' }],
          }),
      });
      await waitFor(() => expect(rendered.widgetBridge.writeSnapshot).toHaveBeenCalledTimes(1));
      return { ...rendered, summary };
    }

    it('인증 판정 중에는 앞 위젯을 그대로 두고 쓰지 않는다', async () => {
      // When
      const { widgetBridge } = await renderSync({ authState: 'resolving' });
      await act(() => jest.advanceTimersByTimeAsync(0));

      // Then
      expect(widgetBridge.writeSnapshot).not.toHaveBeenCalled();
    });

    it('같은 내용을 다시 받으면 다시 쓰지 않는다', async () => {
      // Given
      const { queryClient, widgetBridge } = await renderSyncedOnce();

      // When
      await act(() => invalidateWidgetSummary(queryClient));
      await act(() => jest.advanceTimersByTimeAsync(0));

      // Then
      expect(widgetBridge.writeSnapshot).toHaveBeenCalledTimes(1);
    });

    it('할 일이 바뀌어 다시 받으면 한 번 더 쓴다', async () => {
      // Given
      const { queryClient, widgetBridge, summary } = await renderSyncedOnce();
      summary.title = '바꾼 할 일';

      // When
      await act(() => invalidateWidgetSummary(queryClient));

      // Then
      await waitFor(() => expect(widgetBridge.writeSnapshot).toHaveBeenCalledTimes(2));
      expect(widgetBridge.writeSnapshot.mock.lastCall?.[0].days[0].topTodos).toEqual([
        { id: 1, title: '바꾼 할 일', completed: false, categoryColor: '#FFB3B3' },
      ]);
    });

    it('앱 언어를 바꾸면 같은 요약을 그 언어 문구로 한 번 더 쓴다', async () => {
      // Given
      const { widgetBridge } = await renderSyncedOnce();

      // When
      await act(() => i18n.changeLanguage('en'));

      // Then
      await waitFor(() => expect(widgetBridge.writeSnapshot).toHaveBeenCalledTimes(2));
      expect(widgetBridge.writeSnapshot.mock.lastCall?.[0].days[0].locale).toBe('en');
    });

    it('자정을 넘겨 날짜가 바뀌면 새 오늘의 요약으로 한 번 더 쓴다', async () => {
      // Given
      const { widgetBridge } = await renderSyncedOnce();
      const writtenDates = () =>
        widgetBridge.writeSnapshot.mock.calls.map(([snapshot]) => snapshot.days[0].date);
      const [firstDate] = writtenDates();

      // When
      await act(() => jest.advanceTimersByTimeAsync(DAY_MS));

      // Then
      await waitFor(() =>
        expect(writtenDates()).toEqual([
          firstDate,
          addDaysToDateKey(dateKeySchema.parse(firstDate), 1),
        ]),
      );
    });

    it('로그아웃하면 로그인 안내를 한 번 쓰고 다시 로그인하면 그 계정의 요약을 쓴다', async () => {
      // Given
      const { changeAuthState, writtenStates } = await renderSyncedOnce();

      // When
      await changeAuthState('unauthenticated');
      await act(() => jest.advanceTimersByTimeAsync(0));
      await changeAuthState('authenticated');

      // Then
      await waitFor(() =>
        expect(writtenStates()).toEqual([
          { state: 'data', userId: ACCOUNT_ID },
          { state: 'loggedOut', userId: null },
          { state: 'data', userId: ACCOUNT_ID },
        ]),
      );
    });
  });

  describe('로그아웃·탈퇴와 겹친 동기화', () => {
    it('로그아웃 뒤에 도착한 앞 계정의 요약은 위젯에 쓰지 않고 마지막 기록은 로그아웃이다', async () => {
      // Given
      const lateSummaries: { settle: () => void }[] = [];
      const { changeAuthState, httpClient, writtenStates } = await renderSync({
        authState: 'authenticated',
        getSummary: (date) => {
          const pending = createPendingResponse<Result<unknown, ApiError>>(
            ok(createSummaryDto(date)),
          );
          lateSummaries.push(pending);
          return pending.response;
        },
      });
      await waitFor(() => expect(lateSummaries).toHaveLength(2));

      // When
      await changeAuthState('unauthenticated');
      await act(async () => {
        for (const { settle } of lateSummaries) {
          settle();
        }
      });

      // Then
      await waitFor(() => expect(writtenStates()).toEqual([{ state: 'loggedOut', userId: null }]));
      expect(httpClient.get).toHaveBeenCalledWith('v1/todos/summary', expect.anything());
    });

    it('앞 계정의 요약을 쓰는 중에 로그아웃하면 그 쓰기가 끝난 뒤 로그아웃이 마지막으로 남는다', async () => {
      // Given
      const firstWrite = createPendingResponse(undefined);
      const finishedStates: string[] = [];
      const widgetBridge = createWidgetBridgeStub();
      widgetBridge.writeSnapshot.mockImplementation(async (snapshot) => {
        if (widgetBridge.writeSnapshot.mock.calls.length === 1) {
          await firstWrite.response;
        }
        finishedStates.push(snapshot.days[0].state);
      });
      const { changeAuthState } = await renderSync({ authState: 'authenticated', widgetBridge });
      await waitFor(() => expect(widgetBridge.writeSnapshot).toHaveBeenCalledTimes(1));

      // When
      await changeAuthState('unauthenticated');
      await act(async () => firstWrite.settle());

      // Then
      await waitFor(() => expect(finishedStates).toEqual(['data', 'loggedOut']));
      expect(widgetBridge.writeSnapshot).toHaveBeenLastCalledWith(
        expect.objectContaining({ days: [expect.objectContaining({ state: 'loggedOut' })] }),
        null,
      );
    });
  });

  it('위젯 쓰기 실패는 앱 흐름을 막지 않고 widget 기능으로 보고한다', async () => {
    // Given
    const failure = new Error('native failure');
    const widgetBridge = createWidgetBridgeStub();
    widgetBridge.writeSnapshot.mockRejectedValue(failure);

    // When
    const { errorReporter } = await renderSync({ authState: 'unauthenticated', widgetBridge });

    // Then
    await waitFor(() =>
      expect(errorReporter.captureException).toHaveBeenCalledWith(failure, {
        feature: 'widget',
        method: 'syncLoggedOut',
      }),
    );
  });

  it('앱 없이 깨어난 위젯이 남긴 실패를 시작할 때 한 번 보고하고 지운다', async () => {
    // Given
    const widgetStorage = createMemoryObservableSyncStorage();
    writeStoredValue(widgetStorage, widgetHeadlessFailureStoredValue, {
      method: 'handleWidgetTask',
      name: 'TypeError',
      message: 'activity unavailable',
    });
    const errorReporter = createErrorReporterStub();

    // When
    await renderScreenHook(() => useWidgetSnapshotSync('resolving'), {
      di: createTestDi({ ports: { errorReporter, widgetStorage } }),
      withLocalDate: true,
    });

    // Then
    expect(errorReporter.captureException).toHaveBeenCalledTimes(1);
    expect(errorReporter.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'TypeError', message: 'activity unavailable' }),
      { feature: 'widget', method: 'handleWidgetTask' },
    );
    expect(widgetStorage.keys()).toEqual([]);
  });

  it('헤드리스 실패를 보고하다 오류 보고기가 던져도 시작을 막지 않는다', async () => {
    // Given
    const widgetStorage = createMemoryObservableSyncStorage();
    writeStoredValue(widgetStorage, widgetHeadlessFailureStoredValue, {
      method: 'handleWidgetTask',
      name: 'Error',
      message: 'activity unavailable',
    });
    const errorReporter = createErrorReporterStub();
    errorReporter.captureException.mockImplementation(() => {
      throw new Error('reporter unavailable');
    });

    // When
    const render = renderScreenHook(() => useWidgetSnapshotSync('resolving'), {
      di: createTestDi({ ports: { errorReporter, widgetStorage } }),
      withLocalDate: true,
    });

    // Then
    await expect(render).resolves.toBeDefined();
    expect(widgetStorage.keys()).toEqual([]);
  });
});

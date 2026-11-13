import type { ApiError } from '@src/core/errors/api-error';
import { ok, type Result } from '@src/core/errors/result';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { createDailyCompletionsDto } from '@src/features/planning/todo/__tests__/todo.fixtures';
import { writeStoredValue } from '@src/shared/storage/define-stored-value';
import {
  createErrorReporterStub,
  createHttpClientStub,
  createMemoryObservableSyncStorage,
  createPendingResponse,
  createTestQueryClient,
  createTestDi,
  createWidgetBridgeStub,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { act, waitFor } from '@testing-library/react-native';

import { widgetHeadlessFailureStoredValue } from '../schemas/widget-headless-failure-storage.schema';
import { useWidgetSnapshotSync, type WidgetSyncAuthState } from './use-widget-snapshot-sync';

const ACCOUNT_ID = 'account-a';

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

describe('useWidgetSnapshotSync', () => {
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
        lateSummaries.forEach(({ settle }) => settle());
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

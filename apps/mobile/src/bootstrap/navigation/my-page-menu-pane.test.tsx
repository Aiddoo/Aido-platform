import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { MINUTE_MS } from '@src/shared/constants/time-units';
import { ThemeProvider } from '@src/shared/providers/theme-provider';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createMemoryObservableSyncStorage,
  createTestDi,
  createTestQueryClient,
  getTrackedEvents,
  type TestDi,
} from '@src/testing/core';
import { pressTwiceInSameFrame } from '@src/testing/press';
import { renderScreen } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { focusManager } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { MyPageMenuPane } from './my-page-menu-pane';

const NOW = new Date('2026-11-24T01:00:00.000Z');
const ACTIVE_IMPORT_PATH = 'v1/todo-imports/active';
/** 앱 조회 캐시의 기본 신선 시간(`create-app-query-client`)과 같게 둬 운영처럼 센다 */
const APP_DEFAULT_STALE_TIME_MS = 5 * MINUTE_MS;

function createMenuDi() {
  const httpClient = createHttpClientStub();
  // 진행 중인 가져오기만 답하고, 다른 칸의 조회는 이 테스트와 상관없어 받는 중으로 둔다
  httpClient.get.mockImplementation((path) =>
    path === ACTIVE_IMPORT_PATH
      ? Promise.resolve(ok({ todoImport: null }))
      : new Promise<never>(() => undefined),
  );
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: APP_DEFAULT_STALE_TIME_MS } },
  });
  return { httpClient, di: createTestDi({ ports: { httpClient, queryClient } }) };
}

async function renderMenu(di: TestDi) {
  const rendered = await renderScreen(
    <ThemeProvider syncStorage={createMemoryObservableSyncStorage()}>
      <MyPageMenuPane />
    </ThemeProvider>,
    { di, withLocalDate: true, withOverlay: true },
  );
  await screen.findByText('캘린더 일정 가져오기');
  return rendered;
}

function countActiveImportRequests(httpClient: ReturnType<typeof createHttpClientStub>) {
  return httpClient.get.mock.calls.filter(([path]) => path === ACTIVE_IMPORT_PATH).length;
}

async function moveAppToBackgroundFor(durationMs: number) {
  await act(async () => focusManager.setFocused(false));
  await act(() => jest.advanceTimersByTimeAsync(durationMs));
  await act(async () => focusManager.setFocused(true));
  await act(() => jest.advanceTimersByTimeAsync(0));
}

describe('MyPageMenuPane', () => {
  setupFakeTimersPerTest({ now: NOW, advanceTimers: true });

  afterEach(() => {
    focusManager.setFocused(undefined);
  });

  describe('캘린더 일정 가져오기 줄의 진행 중 조회', () => {
    it('메뉴를 처음 그리면 한 번 묻는다', async () => {
      // Given
      const { httpClient, di } = createMenuDi();

      // When
      await renderMenu(di);

      // Then
      await waitFor(() => expect(countActiveImportRequests(httpClient)).toBe(1));
    });

    it('신선한 동안 메뉴를 다시 마운트해도 더 묻지 않는다', async () => {
      // Given
      const { httpClient, di } = createMenuDi();
      const { unmount } = await renderMenu(di);
      await waitFor(() => expect(countActiveImportRequests(httpClient)).toBe(1));
      await unmount();
      await act(() => jest.advanceTimersByTimeAsync(MINUTE_MS));

      // When
      await renderMenu(di);
      await act(() => jest.advanceTimersByTimeAsync(0));

      // Then
      expect(countActiveImportRequests(httpClient)).toBe(1);
    });

    it('신선한 동안 앱이 뒤로 갔다 돌아와도 더 묻지 않는다', async () => {
      // Given
      const { httpClient, di } = createMenuDi();
      await renderMenu(di);
      await waitFor(() => expect(countActiveImportRequests(httpClient)).toBe(1));

      // When
      await moveAppToBackgroundFor(MINUTE_MS);

      // Then
      expect(countActiveImportRequests(httpClient)).toBe(1);
    });

    it('오래 뒤로 갔다 돌아와도 많아야 한 번 더 묻는다', async () => {
      // Given
      const { httpClient, di } = createMenuDi();
      await renderMenu(di);
      await waitFor(() => expect(countActiveImportRequests(httpClient)).toBe(1));

      // When
      await moveAppToBackgroundFor(10 * MINUTE_MS);

      // Then
      expect(countActiveImportRequests(httpClient)).toBeLessThanOrEqual(2);
    });
  });

  describe('캘린더 일정 가져오기 줄의 입구', () => {
    it('같은 프레임에 두 번 눌러도 마이 탭 메뉴에서 들어왔다고 한 번 센다', async () => {
      // Given
      const httpClient = createHttpClientStub();
      // 이 테스트는 누름만 보므로 줄의 값 조회는 받는 중으로 둔다
      httpClient.get.mockImplementation(() => new Promise<never>(() => undefined));
      const analytics = createAnalyticsStub();
      await renderMenu(createTestDi({ ports: { httpClient, analytics } }));

      // When
      await pressTwiceInSameFrame(screen.getByText('캘린더 일정 가져오기'));

      // Then
      expect(router.push).toHaveBeenCalledTimes(1);
      expect(getTrackedEvents(analytics, 'todo_import_entry_tapped')).toEqual([
        { source: 'mypage' },
      ]);
    });
  });
});

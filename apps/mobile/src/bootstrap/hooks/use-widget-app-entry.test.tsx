import { type WidgetNavigationCommand } from '@src/features/device/widget/domains/widget-navigation.model';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { getNowInstant } from '@src/shared/date/clock';
import { fromEpochMs, toEpochMs } from '@src/shared/date/instant';
import {
  createAnalyticsStub,
  createIncomingLinkGatewayStub,
  createTestDi,
  createTestQueryClient,
  type TestDi,
} from '@src/testing/core';
// 생성된 typed routes가 없는 CI에서는 useSegments 반환이 [string]으로 좁아져 공용 mock의 jest.fn을 직접 쓴다
import { useSegments } from '@src/testing/mocks/expo-router';
import { renderScreenHook } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import type { QueryClient } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';
import { useLinkingURL } from 'expo-linking';
import { router, usePathname } from 'expo-router';

import { useWidgetAppEntry } from './use-widget-app-entry';

/** 위젯을 누른 뒤 5분 안에 앱이 열려야 저장된 목적지로 옮긴다 */
const WIDGET_NAVIGATION_COMMAND_TTL_MS = 5 * 60_000;

let authSessionStore = createAuthSessionStoreStub('loading');
let analytics = createAnalyticsStub();
let incomingLink = createIncomingLinkGatewayStub();
const linkListeners = new Set<(url: string) => void>();

/** 실행 중인 앱에 위젯 링크가 들어온다(Linking `url` 이벤트, 탭마다 한 번) */
async function openLink(url: string) {
  await act(() => {
    linkListeners.forEach((listener) => listener(url));
  });
}

function widgetOpenedCalls() {
  return analytics.trackEvent.mock.calls.filter(([name]) => name === 'widget_opened');
}

describe('종료된 앱의 위젯 명령 복원', () => {
  setupFakeTimersPerTest({ now: new Date('2026-10-05T00:00:00Z') });

  let queryClient: QueryClient;
  let di: TestDi;
  let frames: Map<number, FrameRequestCallback>;
  let nextFrameId: number;
  let command: WidgetNavigationCommand;

  async function flushFrames() {
    await act(() => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(Date.now()));
    });
  }

  function authenticate() {
    authSessionStore.setStatus('authenticated');
    useSegments.mockReturnValue(['(app)', '(tabs)', 'feed']);
    jest.mocked(usePathname).mockReturnValue('/feed');
  }

  beforeEach(() => {
    jest.clearAllMocks();
    frames = new Map();
    nextFrameId = 0;
    jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = ++nextFrameId;
      frames.set(id, callback);
      return id;
    });
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation((id) => {
      if (typeof id === 'number') {
        frames.delete(id);
      }
    });
    authSessionStore = createAuthSessionStoreStub('loading');
    analytics = createAnalyticsStub();
    linkListeners.clear();
    incomingLink = createIncomingLinkGatewayStub();
    incomingLink.subscribe.mockImplementation((listener) => {
      linkListeners.add(listener);
      return () => linkListeners.delete(listener);
    });
    useSegments.mockReturnValue(['loading']);
    jest.mocked(usePathname).mockReturnValue('/loading');
    jest.mocked(useLinkingURL).mockReturnValue('aido://feed?date=today');
    queryClient = createTestQueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'original-account' }));
    di = createTestDi({
      ports: { analytics, incomingLink, queryClient },
      seeds: { authSessionStore },
    });
    command = {
      id: 'first-tap',
      uri: 'aido://todo/12',
      userId: 'original-account',
      createdAt: getNowInstant(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('인증 복원을 기다린 뒤 이전 Linking URL보다 저장된 실제 터치 목적지를 우선한다', async () => {
    // Given
    di.widgetNavigationRepository.save(command);
    const hook = await renderScreenHook(useWidgetAppEntry, { di });
    expect(frames.size).toBe(0);

    // When
    authenticate();
    await hook.rerender(undefined);
    await flushFrames();

    // Then
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/todo/[todoId]',
      params: { todoId: '12' },
    });
    expect(di.widgetNavigationRepository.findPendingCommand()).toBeNull();
    expect(widgetOpenedCalls()).toEqual([['widget_opened', { destination: 'todo' }]]);
    await hook.rerender(undefined);
    await flushFrames();
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(widgetOpenedCalls()).toHaveLength(1);
  });

  it('이동 frame 전에 연속으로 누르면 마지막 명령만 실행한다', async () => {
    // Given
    authenticate();
    di.widgetNavigationRepository.save(command);
    await renderScreenHook(useWidgetAppEntry, { di });

    // When
    await act(() => {
      di.widgetNavigationRepository.save({ ...command, id: 'latest-tap', uri: 'aido://todo/13' });
    });
    await flushFrames();

    // Then
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/todo/[todoId]',
      params: { todoId: '13' },
    });
  });

  it('warm Linking 이동은 중복하지 않고 뒤로간 뒤 같은 목적지를 다시 누르면 이동한다', async () => {
    // Given
    authenticate();
    di.widgetNavigationRepository.save(command);
    const hook = await renderScreenHook(useWidgetAppEntry, { di });

    // When
    jest.mocked(useLinkingURL).mockReturnValue(command.uri);
    jest.mocked(usePathname).mockReturnValue('/todo/12');
    await hook.rerender(undefined);
    await flushFrames();

    // Then
    expect(router.navigate).not.toHaveBeenCalled();
    expect(di.widgetNavigationRepository.findPendingCommand()).toBeNull();

    // When
    jest.mocked(usePathname).mockReturnValue('/feed');
    await hook.rerender(undefined);
    await act(() => di.widgetNavigationRepository.save({ ...command, id: 'second-tap' }));
    await flushFrames();

    // Then
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(widgetOpenedCalls()).toHaveLength(2);
  });

  it('켜진 앱에 명령 없이 들어온 위젯 링크는 Router가 열고 탭마다 센다', async () => {
    // Given
    authenticate();
    jest.mocked(useLinkingURL).mockReturnValue(null);
    await renderScreenHook(useWidgetAppEntry, { di });

    // When
    // iOS 본문 링크는 늘 같은 URL이라 Linking 상태 값은 두 번째 탭에 바뀌지 않는다
    await openLink('aido://feed?date=today');
    await openLink('aido://feed?date=today');
    await openLink('aido://feed?date=today&action=add-todo');
    await flushFrames();

    // Then
    expect(router.navigate).not.toHaveBeenCalled();
    expect(widgetOpenedCalls()).toEqual([
      ['widget_opened', { destination: 'feed' }],
      ['widget_opened', { destination: 'feed' }],
      ['widget_opened', { destination: 'add_todo' }],
    ]);
  });

  describe('Android 명령과 함께 온 피드 깨우기 링크', () => {
    it('링크가 명령 복원보다 먼저 와도 명령 목적지로 한 번만 센다', async () => {
      // Given
      authenticate();
      jest.mocked(useLinkingURL).mockReturnValue(null);
      await renderScreenHook(useWidgetAppEntry, { di });

      // When
      await act(() => {
        di.widgetNavigationRepository.save(command);
      });
      await openLink('aido://feed?date=today');
      await flushFrames();

      // Then
      expect(widgetOpenedCalls()).toEqual([['widget_opened', { destination: 'todo' }]]);
    });

    it('링크가 명령 복원 뒤에 와도 명령 목적지로 한 번만 센다', async () => {
      // Given
      authenticate();
      jest.mocked(useLinkingURL).mockReturnValue(null);
      await renderScreenHook(useWidgetAppEntry, { di });

      // When
      await act(() => {
        di.widgetNavigationRepository.save(command);
      });
      await flushFrames();
      await openLink('aido://feed?date=today');

      // Then
      expect(widgetOpenedCalls()).toEqual([['widget_opened', { destination: 'todo' }]]);
    });

    it('복원하고 한참 뒤 들어온 피드 링크는 새 탭으로 센다', async () => {
      // Given
      authenticate();
      jest.mocked(useLinkingURL).mockReturnValue(null);
      await renderScreenHook(useWidgetAppEntry, { di });
      await act(() => {
        di.widgetNavigationRepository.save(command);
      });
      await flushFrames();

      // When
      jest.setSystemTime(Date.now() + 5_000);
      await openLink('aido://feed?date=today');

      // Then
      expect(widgetOpenedCalls()).toEqual([
        ['widget_opened', { destination: 'todo' }],
        ['widget_opened', { destination: 'feed' }],
      ]);
    });
  });

  it.each(['unauthenticated', 'different-account', 'expired'])(
    '%s 상태에서는 명령을 폐기하고 화면을 이동하지 않는다',
    async (scenario) => {
      // Given
      authenticate();
      jest.mocked(useLinkingURL).mockReturnValue(null);
      if (scenario === 'unauthenticated') {
        authSessionStore.setStatus('unauthenticated');
      }
      if (scenario === 'different-account') {
        queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'other-account' }));
      }
      di.widgetNavigationRepository.save(
        scenario === 'expired'
          ? {
              ...command,
              createdAt: fromEpochMs(toEpochMs(getNowInstant()) - WIDGET_NAVIGATION_COMMAND_TTL_MS),
            }
          : command,
      );

      // When
      await renderScreenHook(useWidgetAppEntry, { di });
      await flushFrames();

      // Then
      expect(router.navigate).not.toHaveBeenCalled();
      expect(di.widgetNavigationRepository.findPendingCommand()).toBeNull();
      expect(widgetOpenedCalls()).toEqual([]);
    },
  );

  it('frame 직전에 바뀐 계정으로 이전 명령을 실행하지 않는다', async () => {
    // Given
    authenticate();
    di.widgetNavigationRepository.save(command);
    await renderScreenHook(useWidgetAppEntry, { di });

    // When
    queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'other-account' }));
    await flushFrames();

    // Then
    expect(router.navigate).not.toHaveBeenCalled();
    expect(di.widgetNavigationRepository.findPendingCommand()).toBeNull();
  });

  it.each(['aido://todo/12', 'aido://feed?date=today&action=add-todo'])(
    '일반 홈으로 앱을 깨워도 이전 계정의 %s 명령은 복원하지 않는다',
    async (uri) => {
      // Given
      jest.mocked(useLinkingURL).mockReturnValue('aido://feed?date=today');
      queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'other-account' }));
      di.widgetNavigationRepository.save({ ...command, uri });
      const hook = await renderScreenHook(useWidgetAppEntry, { di });

      // When
      authenticate();
      await hook.rerender(undefined);
      await flushFrames();
      await hook.rerender(undefined);
      await flushFrames();

      // Then
      expect(router.navigate).not.toHaveBeenCalled();
      expect(di.widgetNavigationRepository.findPendingCommand()).toBeNull();
    },
  );

  it('화면이 해제되면 예약한 frame을 취소하고 명령은 다음 진입에 남긴다', async () => {
    // Given
    authenticate();
    di.widgetNavigationRepository.save(command);
    const hook = await renderScreenHook(useWidgetAppEntry, { di });
    expect(frames.size).toBe(1);

    // When
    await hook.unmount();
    await flushFrames();

    // Then
    expect(router.navigate).not.toHaveBeenCalled();
    expect(di.widgetNavigationRepository.findPendingCommand()).toEqual(command);
  });
});

import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { type WidgetNavigationCommand } from '@src/features/device/widget/domains/widget-navigation.model';
import {
  createWidgetNavigationRepository,
  type WidgetNavigationRepository,
} from '@src/features/device/widget/repositories/widget-navigation.repository';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import {
  createTestDi,
  createMemoryObservableSyncStorage,
  createTestQueryClient,
} from '@src/testing/core';
// 생성된 typed routes가 없는 CI에서는 useSegments 반환이 [string]으로 좁아져 공용 mock의 jest.fn을 직접 쓴다
import { useSegments } from '@src/testing/mocks/expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { useLinkingURL } from 'expo-linking';
import { router, usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { useWidgetAppEntry } from './use-widget-app-entry';

/** 위젯을 누른 뒤 5분 안에 앱이 열려야 저장된 목적지로 옮긴다 */
const WIDGET_NAVIGATION_COMMAND_TTL_MS = 5 * 60_000;

let authSessionStore = createAuthSessionStoreStub('loading');
let mockRepository: WidgetNavigationRepository;

describe('종료된 앱의 위젯 명령 복원', () => {
  let queryClient: QueryClient;
  let frames: Map<number, FrameRequestCallback>;
  let nextFrameId: number;
  let command: WidgetNavigationCommand;

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <StaticDIProvider
          container={createTestDi({
            authSessionStore,
            widgetNavigationRepository: mockRepository,
          })}
        >
          {children}
        </StaticDIProvider>
      </QueryClientProvider>
    );
  }

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
    // oxlint-disable-next-line jest/no-restricted-jest-methods -- 1.15.2 전환 #1400
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-05T00:00:00Z'));
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
    useSegments.mockReturnValue(['loading']);
    jest.mocked(usePathname).mockReturnValue('/loading');
    jest.mocked(useLinkingURL).mockReturnValue('aido://feed?date=today');
    mockRepository = createWidgetNavigationRepository(createMemoryObservableSyncStorage());
    queryClient = createTestQueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'original-account' }));
    command = {
      id: 'first-tap',
      uri: 'aido://todo/12',
      userId: 'original-account',
      createdAt: Date.now(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // oxlint-disable-next-line jest/no-restricted-jest-methods -- 1.15.2 전환 #1400
    jest.useRealTimers();
  });

  it('인증 복원을 기다린 뒤 이전 Linking URL보다 저장된 실제 터치 목적지를 우선한다', async () => {
    // Given
    mockRepository.save(command);
    const hook = await renderHook(useWidgetAppEntry, { wrapper: Wrapper });
    expect(frames.size).toBe(0);

    // When
    authenticate();
    await hook.rerender(undefined);
    await flushFrames();

    // Then
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(
      { pathname: '/todo/[todoId]', params: { todoId: '12' } },
      { withAnchor: true },
    );
    expect(mockRepository.findPendingCommand()).toBeNull();
    await hook.rerender(undefined);
    await flushFrames();
    expect(router.navigate).toHaveBeenCalledTimes(1);
  });

  it('이동 frame 전에 연속으로 누르면 마지막 명령만 실행한다', async () => {
    // Given
    authenticate();
    mockRepository.save(command);
    await renderHook(useWidgetAppEntry, { wrapper: Wrapper });

    // When
    await act(() => {
      mockRepository.save({ ...command, id: 'latest-tap', uri: 'aido://todo/13' });
    });
    await flushFrames();

    // Then
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(
      { pathname: '/todo/[todoId]', params: { todoId: '13' } },
      { withAnchor: true },
    );
  });

  it('warm Linking 이동은 중복하지 않고 뒤로간 뒤 같은 목적지를 다시 누르면 이동한다', async () => {
    // Given
    authenticate();
    mockRepository.save(command);
    const hook = await renderHook(useWidgetAppEntry, { wrapper: Wrapper });

    // When
    jest.mocked(useLinkingURL).mockReturnValue(command.uri);
    jest.mocked(usePathname).mockReturnValue('/todo/12');
    await hook.rerender(undefined);
    await flushFrames();

    // Then
    expect(router.navigate).not.toHaveBeenCalled();
    expect(mockRepository.findPendingCommand()).toBeNull();

    // When
    jest.mocked(usePathname).mockReturnValue('/feed');
    await hook.rerender(undefined);
    await act(() => mockRepository.save({ ...command, id: 'second-tap' }));
    await flushFrames();

    // Then
    expect(router.navigate).toHaveBeenCalledTimes(1);
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
      mockRepository.save(
        scenario === 'expired'
          ? { ...command, createdAt: Date.now() - WIDGET_NAVIGATION_COMMAND_TTL_MS }
          : command,
      );

      // When
      await renderHook(useWidgetAppEntry, { wrapper: Wrapper });
      await flushFrames();

      // Then
      expect(router.navigate).not.toHaveBeenCalled();
      expect(mockRepository.findPendingCommand()).toBeNull();
    },
  );

  it('frame 직전에 바뀐 계정으로 이전 명령을 실행하지 않는다', async () => {
    // Given
    authenticate();
    mockRepository.save(command);
    await renderHook(useWidgetAppEntry, { wrapper: Wrapper });

    // When
    queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'other-account' }));
    await flushFrames();

    // Then
    expect(router.navigate).not.toHaveBeenCalled();
    expect(mockRepository.findPendingCommand()).toBeNull();
  });

  it.each(['aido://todo/12', 'aido://feed?date=today&action=add-todo'])(
    '일반 홈으로 앱을 깨워도 이전 계정의 %s 명령은 복원하지 않는다',
    async (uri) => {
      // Given
      jest.mocked(useLinkingURL).mockReturnValue('aido://feed?date=today');
      queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'other-account' }));
      mockRepository.save({ ...command, uri });
      const hook = await renderHook(useWidgetAppEntry, { wrapper: Wrapper });

      // When
      authenticate();
      await hook.rerender(undefined);
      await flushFrames();
      await hook.rerender(undefined);
      await flushFrames();

      // Then
      expect(router.navigate).not.toHaveBeenCalled();
      expect(mockRepository.findPendingCommand()).toBeNull();
    },
  );

  it('화면이 해제되면 예약한 frame을 취소하고 명령은 다음 진입에 남긴다', async () => {
    // Given
    authenticate();
    mockRepository.save(command);
    const hook = await renderHook(useWidgetAppEntry, { wrapper: Wrapper });
    expect(frames.size).toBe(1);

    // When
    await hook.unmount();
    await flushFrames();

    // Then
    expect(router.navigate).not.toHaveBeenCalled();
    expect(mockRepository.findPendingCommand()).toEqual(command);
  });
});

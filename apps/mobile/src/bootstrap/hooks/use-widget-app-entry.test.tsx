import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import {
  createWidgetNavigationRepository,
  type WidgetNavigationRepository,
} from '@src/features/device/widget/apis/widget-navigation.repository';
import { WIDGET_NAVIGATION_COMMAND_TTL_MS } from '@src/features/device/widget/domains/widget-navigation.model';
import { type WidgetNavigationCommand } from '@src/features/device/widget/schemas/widget-navigation.schema';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/auth-session.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import { createTestDi, createMemoryObservableSyncStorage } from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { useLinkingURL } from 'expo-linking';
import { router, usePathname, useSegments } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { useWidgetAppEntry } from './use-widget-app-entry';

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
    jest.mocked(useSegments).mockReturnValue(['(app)', '(tabs)', 'feed']);
    jest.mocked(usePathname).mockReturnValue('/feed');
  }

  beforeEach(() => {
    jest.clearAllMocks();
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
    jest.mocked(useSegments).mockReturnValue(['loading']);
    jest.mocked(usePathname).mockReturnValue('/loading');
    jest.mocked(useLinkingURL).mockReturnValue('aido://feed?date=today');
    mockRepository = createWidgetNavigationRepository(createMemoryObservableSyncStorage());
    queryClient = createTestQueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
    queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: 'original-account' });
    command = {
      id: 'first-tap',
      uri: 'aido://todo/12',
      userId: 'original-account',
      createdAt: Date.now(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('인증 복원을 기다린 뒤 이전 Linking URL보다 저장된 실제 터치 목적지를 우선한다', async () => {
    // Given
    mockRepository.store(command);
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
    expect(mockRepository.getPendingCommand()).toBeNull();
    await hook.rerender(undefined);
    await flushFrames();
    expect(router.navigate).toHaveBeenCalledTimes(1);
  });

  it('이동 frame 전에 연속으로 누르면 마지막 명령만 실행한다', async () => {
    // Given
    authenticate();
    mockRepository.store(command);
    await renderHook(useWidgetAppEntry, { wrapper: Wrapper });

    // When
    await act(() => {
      mockRepository.store({ ...command, id: 'latest-tap', uri: 'aido://todo/13' });
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
    mockRepository.store(command);
    const hook = await renderHook(useWidgetAppEntry, { wrapper: Wrapper });

    // When
    jest.mocked(useLinkingURL).mockReturnValue(command.uri);
    jest.mocked(usePathname).mockReturnValue('/todo/12');
    await hook.rerender(undefined);
    await flushFrames();

    // Then
    expect(router.navigate).not.toHaveBeenCalled();
    expect(mockRepository.getPendingCommand()).toBeNull();

    // When
    jest.mocked(usePathname).mockReturnValue('/feed');
    await hook.rerender(undefined);
    await act(() => mockRepository.store({ ...command, id: 'second-tap' }));
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
        queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: 'other-account' });
      }
      mockRepository.store(
        scenario === 'expired'
          ? { ...command, createdAt: Date.now() - WIDGET_NAVIGATION_COMMAND_TTL_MS }
          : command,
      );

      // When
      await renderHook(useWidgetAppEntry, { wrapper: Wrapper });
      await flushFrames();

      // Then
      expect(router.navigate).not.toHaveBeenCalled();
      expect(mockRepository.getPendingCommand()).toBeNull();
    },
  );

  it('frame 직전에 바뀐 계정으로 이전 명령을 실행하지 않는다', async () => {
    // Given
    authenticate();
    mockRepository.store(command);
    await renderHook(useWidgetAppEntry, { wrapper: Wrapper });

    // When
    queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: 'other-account' });
    await flushFrames();

    // Then
    expect(router.navigate).not.toHaveBeenCalled();
    expect(mockRepository.getPendingCommand()).toBeNull();
  });

  it.each(['aido://todo/12', 'aido://feed?date=today&action=add-todo'])(
    '일반 홈으로 앱을 깨워도 이전 계정의 %s 명령은 복원하지 않는다',
    async (uri) => {
      // Given
      jest.mocked(useLinkingURL).mockReturnValue('aido://feed?date=today');
      queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: 'other-account' });
      mockRepository.store({ ...command, uri });
      const hook = await renderHook(useWidgetAppEntry, { wrapper: Wrapper });

      // When
      authenticate();
      await hook.rerender(undefined);
      await flushFrames();
      await hook.rerender(undefined);
      await flushFrames();

      // Then
      expect(router.navigate).not.toHaveBeenCalled();
      expect(mockRepository.getPendingCommand()).toBeNull();
    },
  );

  it('화면이 해제되면 예약한 frame을 취소하고 명령은 다음 진입에 남긴다', async () => {
    // Given
    authenticate();
    mockRepository.store(command);
    const hook = await renderHook(useWidgetAppEntry, { wrapper: Wrapper });
    expect(frames.size).toBe(1);

    // When
    await hook.unmount();
    await flushFrames();

    // Then
    expect(router.navigate).not.toHaveBeenCalled();
    expect(mockRepository.getPendingCommand()).toEqual(command);
  });
});

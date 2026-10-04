import { USER_QUERY_KEYS } from '@src/features/user/presentations/constants/user-query-keys.constant';
import type { WidgetNavigationStorage } from '@src/features/widget/bridge/widget-navigation-storage';
import {
  type WidgetNavigationCommand,
  WIDGET_NAVIGATION_COMMAND_TTL_MS,
} from '@src/features/widget/models/widget-navigation.model';
import {
  createWidgetNavigationRepository,
  type WidgetNavigationRepository,
} from '@src/features/widget/services/widget-navigation.repository';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';

import { useWidgetAppEntry } from './use-widget-app-entry';

let mockStatus = 'loading';
let mockSegments = ['loading'];
let mockPathname = '/loading';
let mockParameters: Record<string, string> = {};
let mockUrl: string | null = 'aido://feed?date=today';
let mockRepository: WidgetNavigationRepository;
const mockErrorReporter = { addBreadcrumb: jest.fn(), captureException: jest.fn() };

jest.mock('../providers/auth-provider', () => ({ useAuth: () => ({ status: mockStatus }) }));
jest.mock('../providers/di-context', () => ({
  useErrorReporter: () => mockErrorReporter,
  useWidgetNavigationRepository: () => mockRepository,
}));
jest.mock('@src/features/user/presentations/queries/get-me-query-options', () => ({
  useGetMeQueryOptions: () => ({
    queryKey: ['user', 'me'],
    queryFn: async () => ({ id: 'original-account' }),
    staleTime: Infinity,
  }),
}));
jest.mock('expo-linking', () => ({ useLinkingURL: () => mockUrl }));
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn() },
  useSegments: () => mockSegments,
  usePathname: () => mockPathname,
  useGlobalSearchParams: () => mockParameters,
}));

function createStorage(): WidgetNavigationStorage {
  const values = new Map<string, string>();
  const listeners = new Set<() => void>();
  return {
    getString: (key) => values.get(key),
    set: (key, value) => {
      values.set(key, value);
      listeners.forEach((listener) => listener());
    },
    delete: (key) => {
      values.delete(key);
      listeners.forEach((listener) => listener());
    },
    subscribe: (_key, listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

describe('종료된 앱의 위젯 명령 복원', () => {
  let queryClient: QueryClient;
  let frames: Map<number, FrameRequestCallback>;
  let nextFrameId: number;
  let command: WidgetNavigationCommand;

  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  async function flushFrames() {
    await act(() => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(Date.now()));
    });
  }

  function authenticate() {
    mockStatus = 'authenticated';
    mockSegments = ['(app)', '(tabs)', 'feed'];
    mockPathname = '/feed';
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
      if (typeof id === 'number') frames.delete(id);
    });
    mockStatus = 'loading';
    mockSegments = ['loading'];
    mockPathname = '/loading';
    mockParameters = {};
    mockUrl = 'aido://feed?date=today';
    mockRepository = createWidgetNavigationRepository(createStorage());
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    queryClient.setQueryData(USER_QUERY_KEYS.me(), { id: 'original-account' });
    command = {
      id: 'first-tap',
      uri: 'aido://todo/12',
      userId: 'original-account',
      createdAt: Date.now(),
    };
  });

  afterEach(() => {
    queryClient.clear();
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
    mockUrl = command.uri;
    mockPathname = '/todo/12';
    await hook.rerender(undefined);
    await flushFrames();

    // Then
    expect(router.navigate).not.toHaveBeenCalled();
    expect(mockRepository.getPendingCommand()).toBeNull();

    // When
    mockPathname = '/feed';
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
      mockUrl = null;
      if (scenario === 'unauthenticated') mockStatus = 'unauthenticated';
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

import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { OverlayStateContext } from '@src/shared/ui/overlay/overlay-state-context';
import {
  type AppLifecycleGatewayStub,
  createAppLifecycleGatewayStub,
  createIncomingLinkGatewayStub,
  createTestDi,
  type TestDi,
} from '@src/testing/core';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { type IKeyboardState, useKeyboardState } from 'react-native-keyboard-controller';

import { isStableFeedForeground, useStableFeedForeground } from './use-stable-feed-foreground';

let incomingLink: ReturnType<typeof createIncomingLinkGatewayStub>;
let appLifecycle: AppLifecycleGatewayStub;
let di: TestDi;
let deepLinkListener: ((url: string) => void) | undefined;
let idleCallbacks: Array<() => void> = [];

const mockUseKeyboardState = jest.mocked(useKeyboardState);

const createKeyboardState = (isVisible: boolean): IKeyboardState => ({
  isVisible,
  height: isVisible ? 300 : 0,
  duration: 250,
  timestamp: 0,
  target: -1,
  type: 'default',
  appearance: 'light',
});

function OverlayStateWrapper({ children }: PropsWithChildren) {
  return (
    <StaticDIProvider container={di}>
      <OverlayStateContext.Provider value={{ hasActiveOverlay: false }}>
        {children}
      </OverlayStateContext.Provider>
    </StaticDIProvider>
  );
}

function useStableInFeed() {
  return useStableFeedForeground({ authStatus: 'authenticated', hasPendingNavigation: false });
}

describe('useStableFeedForeground', () => {
  beforeEach(() => {
    deepLinkListener = undefined;
    idleCallbacks = [];
    appLifecycle = createAppLifecycleGatewayStub();
    mockUseKeyboardState.mockImplementation((selector) => {
      const state = createKeyboardState(false);
      return selector == null ? state : selector(state);
    });
    incomingLink = createIncomingLinkGatewayStub();
    incomingLink.subscribe.mockImplementation((listener) => {
      deepLinkListener = listener;
      return () => {};
    });
    di = createTestDi({ ports: { incomingLink, appLifecycle } });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    Object.defineProperty(globalThis, 'requestIdleCallback', {
      configurable: true,
      value: jest.fn((callback: IdleRequestCallback) => {
        idleCallbacks.push(() => callback({ didTimeout: false, timeRemaining: () => 10 }));
        return idleCallbacks.length;
      }),
    });
    Object.defineProperty(globalThis, 'cancelIdleCallback', {
      configurable: true,
      value: jest.fn(),
    });
  });

  it('딥링크 라우팅 상호작용이 끝나면 같은 focus에서도 대기 상태를 해제한다', async () => {
    // Given
    incomingLink.getInitialUrl.mockResolvedValue('aido://feed');
    const { result } = await renderHook(() => useStableInFeed(), { wrapper: OverlayStateWrapper });

    // When
    await act(async () => {
      await Promise.resolve();
    });

    // Then
    expect(result.current).toBe(false);
    await act(async () => {
      idleCallbacks.shift()?.();
    });
    await waitFor(() => expect(result.current).toBe(true));
    expect(globalThis.requestIdleCallback).toHaveBeenCalled();
  });

  it('포커스를 유지한 런타임 딥링크도 라우팅 상호작용이 끝날 때까지 노출을 미룬다', async () => {
    // Given
    const { result } = await renderHook(() => useStableInFeed(), { wrapper: OverlayStateWrapper });
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBe(true);

    // When
    await act(async () => {
      deepLinkListener?.('aido://feed');
    });

    // Then
    expect(result.current).toBe(false);

    // When
    await act(async () => {
      idleCallbacks.shift()?.();
    });

    // Then
    expect(result.current).toBe(true);
  });

  it('화면을 떠나면 대기 중인 딥링크 해제를 취소한다', async () => {
    // Given
    incomingLink.getInitialUrl.mockResolvedValue('aido://feed');
    const hook = await renderHook(() => useStableInFeed(), { wrapper: OverlayStateWrapper });
    await act(async () => {
      await Promise.resolve();
    });
    expect(globalThis.requestIdleCallback).toHaveBeenCalledTimes(1);

    // When
    await hook.unmount();

    // Then
    expect(globalThis.cancelIdleCallback).toHaveBeenCalledWith(1);
  });
});

const stableInput: Parameters<typeof isStableFeedForeground>[0] = {
  authStatus: 'authenticated',
  isFocused: true,
  isAppActive: true,
  isKeyboardVisible: false,
  hasActiveOverlay: false,
  hasPendingDeepLink: false,
  hasPendingNavigation: false,
};

describe('isStableFeedForeground', () => {
  it('인증된 피드가 포그라운드에서 방해 요소 없이 포커스되면 true를 반환한다', () => {
    // When
    const result = isStableFeedForeground(stableInput);

    // Then
    expect(result).toBe(true);
  });

  it.each<{ label: string; overrides: Partial<typeof stableInput> }>([
    { label: '로그인 전', overrides: { authStatus: 'unauthenticated' } },
    { label: '로그인 판정 전', overrides: { authStatus: 'loading' } },
    { label: '키체인 잠김', overrides: { authStatus: 'locked' } },
    { label: '다른 화면', overrides: { isFocused: false } },
    { label: '백그라운드', overrides: { isAppActive: false } },
    { label: '키보드', overrides: { isKeyboardVisible: true } },
    { label: '피드 폼 또는 다른 오버레이', overrides: { hasActiveOverlay: true } },
    { label: '딥 링크', overrides: { hasPendingDeepLink: true } },
    { label: '눌린 푸시 처리 중', overrides: { hasPendingNavigation: true } },
  ])('$label 상태에서는 false를 반환한다', ({ overrides }) => {
    // When
    const result = isStableFeedForeground({ ...stableInput, ...overrides });

    // Then
    expect(result).toBe(false);
  });
});

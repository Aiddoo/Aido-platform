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

import { useStableFeedForeground } from './use-stable-feed-foreground';

let mockHasActiveOverlay = false;
let mockIsKeyboardVisible = false;
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
      <OverlayStateContext.Provider value={{ hasActiveOverlay: mockHasActiveOverlay }}>
        {children}
      </OverlayStateContext.Provider>
    </StaticDIProvider>
  );
}

function useStableInFeed({ hasPendingNavigation = false } = {}) {
  return useStableFeedForeground({ isAuthenticated: true, hasPendingNavigation });
}

describe('useStableFeedForeground', () => {
  beforeEach(() => {
    mockHasActiveOverlay = false;
    mockIsKeyboardVisible = false;
    deepLinkListener = undefined;
    idleCallbacks = [];
    appLifecycle = createAppLifecycleGatewayStub();
    mockUseKeyboardState.mockImplementation((selector) => {
      const state = createKeyboardState(mockIsKeyboardVisible);
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

  it('실제 OverlayProvider의 폼/오버레이 신호가 활성인 동안만 자동 노출을 막는다', async () => {
    // Given
    mockHasActiveOverlay = true;
    const hook = await renderHook(() => useStableInFeed(), { wrapper: OverlayStateWrapper });
    await act(async () => {
      await Promise.resolve();
    });

    // Then
    expect(hook.result.current).toBe(false);

    // When
    mockHasActiveOverlay = false;
    await hook.rerender(undefined);

    // Then
    await waitFor(() => expect(hook.result.current).toBe(true));
  });

  it('키보드가 올라와 있는 동안은 자동 노출을 막는다', async () => {
    // Given
    mockIsKeyboardVisible = true;
    const hook = await renderHook(() => useStableInFeed(), { wrapper: OverlayStateWrapper });
    await act(async () => {
      await Promise.resolve();
    });

    // Then
    expect(hook.result.current).toBe(false);

    // When
    mockIsKeyboardVisible = false;
    await hook.rerender(undefined);

    // Then
    await waitFor(() => expect(hook.result.current).toBe(true));
  });

  it('눌린 푸시를 처리하는 동안은 안정되지 않았다고 본다', async () => {
    // Given
    const { result, rerender } = await renderHook(
      (props: { hasPendingNavigation: boolean }) => useStableInFeed(props),
      { initialProps: { hasPendingNavigation: true }, wrapper: OverlayStateWrapper },
    );
    await act(async () => {
      await Promise.resolve();
    });

    // Then
    expect(result.current).toBe(false);

    // When
    await rerender({ hasPendingNavigation: false });

    // Then
    expect(result.current).toBe(true);
  });
});

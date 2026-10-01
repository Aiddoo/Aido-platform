import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import type { EffectCallback } from 'react';
import { AppState, Keyboard } from 'react-native';

import { useStableFeedForeground } from './use-stable-feed-foreground';

let mockHasActiveOverlay = false;
let focusEffect: EffectCallback | undefined;
let deepLinkListener: Parameters<typeof Linking.addEventListener>[1] | undefined;
let idleCallbacks: Array<() => void> = [];

jest.mock('@src/bootstrap/providers/auth-provider', () => ({
  useAuth: () => ({ status: 'authenticated' }),
}));

jest.mock('@src/shared/ui', () => ({
  useOverlayState: () => ({ hasActiveOverlay: mockHasActiveOverlay }),
}));

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: EffectCallback) => {
    focusEffect = effect;
  },
}));

describe('useStableFeedForeground', () => {
  beforeEach(() => {
    mockHasActiveOverlay = false;
    focusEffect = undefined;
    deepLinkListener = undefined;
    idleCallbacks = [];
    Object.defineProperty(AppState, 'currentState', {
      configurable: true,
      value: 'active',
    });
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    jest.spyOn(Keyboard, 'addListener').mockReturnValue({ remove: jest.fn() } as never);
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest.spyOn(Linking, 'addEventListener').mockImplementation((_event, listener) => {
      deepLinkListener = listener;
      return { remove: jest.fn() } as never;
    });
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
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('aido://feed');
    const { result } = await renderHook(() => useStableFeedForeground());

    // When
    await act(async () => {
      focusEffect?.();
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
    const { result } = await renderHook(() => useStableFeedForeground());
    await act(async () => {
      focusEffect?.();
      await Promise.resolve();
    });
    expect(result.current).toBe(true);

    // When
    await act(async () => {
      deepLinkListener?.({ url: 'aido://feed' });
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
    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('aido://feed');
    const hook = await renderHook(() => useStableFeedForeground());
    await act(async () => {
      await Promise.resolve();
    });
    expect(globalThis.requestIdleCallback).toHaveBeenCalledTimes(1);

    await hook.unmount();
    expect(globalThis.cancelIdleCallback).toHaveBeenCalledWith(1);
  });

  it('실제 OverlayProvider의 폼/오버레이 신호가 활성인 동안만 자동 노출을 막는다', async () => {
    // Given
    mockHasActiveOverlay = true;
    const hook = await renderHook(() => useStableFeedForeground());
    await act(async () => {
      focusEffect?.();
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
});

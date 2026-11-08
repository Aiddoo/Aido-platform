import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createAppLifecycleGatewayStub, createTestDi } from '@src/shared/__tests__';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { useAppForegroundEffect } from './use-app-foreground-effect';
import { useIsAppActive } from './use-is-app-active';

function setup() {
  const appLifecycle = createAppLifecycleGatewayStub();
  const container = createTestDi({ appLifecycle });
  function wrapper({ children }: PropsWithChildren) {
    return <StaticDIProvider container={container}>{children}</StaticDIProvider>;
  }
  return { appLifecycle, wrapper };
}

describe('useIsAppActive', () => {
  it('앱 상태가 바뀌면 따라간다', async () => {
    // Given
    const { appLifecycle, wrapper } = setup();
    const { result } = await renderHook(() => useIsAppActive(), { wrapper });

    // When
    await act(async () => appLifecycle.emit('background'));
    const whileBackground = result.current;
    await act(async () => appLifecycle.emit('active'));

    // Then
    expect(whileBackground).toBe(false);
    expect(result.current).toBe(true);
  });
});

describe('useAppForegroundEffect', () => {
  it('앞으로 돌아올 때만 가장 최근 콜백을 부른다', async () => {
    // Given
    const { appLifecycle, wrapper } = setup();
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = await renderHook(
      ({ callback }: { callback: () => void }) => useAppForegroundEffect(callback),
      { wrapper, initialProps: { callback: first } },
    );
    await rerender({ callback: second });

    // When
    await act(async () => appLifecycle.emit('background'));
    await act(async () => appLifecycle.emit('active'));

    // Then
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('언마운트하면 구독을 끝낸다', async () => {
    // Given
    const { appLifecycle, wrapper } = setup();
    const { unmount } = await renderHook(() => useAppForegroundEffect(jest.fn()), { wrapper });

    // When
    await unmount();

    // Then
    expect(appLifecycle.getListenerCount()).toBe(0);
  });
});

import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createAppLifecycleGatewayStub, createTestDi } from '@src/shared/__tests__';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { useOnAppForeground } from './use-on-app-foreground';

async function setup() {
  const appLifecycle = createAppLifecycleGatewayStub();
  const onForeground = jest.fn();
  function wrapper({ children }: PropsWithChildren) {
    return (
      <StaticDIProvider container={createTestDi({ appLifecycle })}>{children}</StaticDIProvider>
    );
  }
  const hook = await renderHook(
    ({ onForeground: callback }: { onForeground: () => void }) => useOnAppForeground(callback),
    { wrapper, initialProps: { onForeground } },
  );
  return { ...hook, appLifecycle, onForeground };
}

describe('useOnAppForeground', () => {
  it('뒤로 갔다가 돌아올 때마다 한 번씩 부른다', async () => {
    // Given
    const { appLifecycle, onForeground } = await setup();

    // When
    await act(async () => appLifecycle.emit('background'));
    await act(async () => appLifecycle.emit('active'));
    await act(async () => appLifecycle.emit('inactive'));
    await act(async () => appLifecycle.emit('active'));

    // Then
    expect(onForeground).toHaveBeenCalledTimes(2);
  });

  it('마운트할 때와 이미 앞인 상태의 반복 알림에는 부르지 않는다', async () => {
    // Given
    const { appLifecycle, onForeground } = await setup();

    // When
    await act(async () => appLifecycle.emit('active'));

    // Then
    expect(onForeground).not.toHaveBeenCalled();
  });

  it('다시 렌더돼 바뀐 최신 콜백을 구독 그대로 부른다', async () => {
    // Given
    const { appLifecycle, rerender, onForeground } = await setup();
    const latest = jest.fn();
    await rerender({ onForeground: latest });

    // When
    await act(async () => appLifecycle.emit('background'));
    await act(async () => appLifecycle.emit('active'));

    // Then
    expect(onForeground).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(appLifecycle.subscribe).toHaveBeenCalledTimes(1);
  });

  it('언마운트하면 구독을 푼다', async () => {
    // Given
    const { appLifecycle, unmount, onForeground } = await setup();

    // When
    await unmount();
    await act(async () => appLifecycle.emit('background'));
    await act(async () => appLifecycle.emit('active'));

    // Then
    expect(appLifecycle.getListenerCount()).toBe(0);
    expect(onForeground).not.toHaveBeenCalled();
  });
});

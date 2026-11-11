import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createAppLifecycleGatewayStub, createTestDi } from '@src/testing/core';
import { onlineManager } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { usePendingRevocationFlush } from './use-pending-revocation-flush';

function setup() {
  const appLifecycle = createAppLifecycleGatewayStub();
  const container = createTestDi({ appLifecycle });
  const flush = jest.spyOn(container.sessionRevocationService, 'flush').mockResolvedValue();
  function wrapper({ children }: PropsWithChildren) {
    return <StaticDIProvider container={container}>{children}</StaticDIProvider>;
  }
  return { appLifecycle, flush, wrapper };
}

describe('usePendingRevocationFlush', () => {
  beforeEach(() => {
    onlineManager.setOnline(true);
  });

  it('앱으로 돌아올 때마다 남은 세션 해제를 다시 시도한다', async () => {
    // Given
    const { appLifecycle, flush, wrapper } = setup();
    await renderHook(() => usePendingRevocationFlush(), { wrapper });
    flush.mockClear();

    // When
    await act(async () => appLifecycle.emit('background'));
    await act(async () => appLifecycle.emit('active'));

    // Then
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('이미 앞에 있는 동안 다시 active를 받아도 시도하지 않는다', async () => {
    // Given
    const { appLifecycle, flush, wrapper } = setup();
    await renderHook(() => usePendingRevocationFlush(), { wrapper });
    flush.mockClear();

    // When
    await act(async () => appLifecycle.emit('active'));

    // Then
    expect(flush).not.toHaveBeenCalled();
  });

  it('화면이 내려가면 앱 상태 구독을 끝낸다', async () => {
    // Given
    const { appLifecycle, wrapper } = setup();
    const { unmount } = await renderHook(() => usePendingRevocationFlush(), { wrapper });

    // When
    await unmount();

    // Then
    expect(appLifecycle.getListenerCount()).toBe(0);
  });
});

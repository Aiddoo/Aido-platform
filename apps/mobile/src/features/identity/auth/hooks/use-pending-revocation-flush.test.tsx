import { createAppLifecycleGatewayStub, createTestDi } from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { onlineManager } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';

import { usePendingRevocationFlush } from './use-pending-revocation-flush';

function setup() {
  const appLifecycle = createAppLifecycleGatewayStub();
  const di = createTestDi({ ports: { appLifecycle } });
  const flush = jest.spyOn(di.sessionRevocationService, 'flush').mockResolvedValue();
  return { appLifecycle, flush, di };
}

describe('usePendingRevocationFlush', () => {
  beforeEach(() => {
    onlineManager.setOnline(true);
  });

  it('앱으로 돌아올 때마다 남은 세션 해제를 다시 시도한다', async () => {
    // Given
    const { appLifecycle, flush, di } = setup();
    await renderScreenHook(() => usePendingRevocationFlush(), { di });
    flush.mockClear();

    // When
    await act(async () => appLifecycle.emit('background'));
    await act(async () => appLifecycle.emit('active'));

    // Then
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('이미 앞에 있는 동안 다시 active를 받아도 시도하지 않는다', async () => {
    // Given
    const { appLifecycle, flush, di } = setup();
    await renderScreenHook(() => usePendingRevocationFlush(), { di });
    flush.mockClear();

    // When
    await act(async () => appLifecycle.emit('active'));

    // Then
    expect(flush).not.toHaveBeenCalled();
  });

  it('화면이 내려가면 앱 상태 구독을 끝낸다', async () => {
    // Given
    const { appLifecycle, di } = setup();
    const { unmount } = await renderScreenHook(() => usePendingRevocationFlush(), { di });

    // When
    await unmount();

    // Then
    expect(appLifecycle.getListenerCount()).toBe(0);
  });
});

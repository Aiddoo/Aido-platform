import type { RefreshTokensRequest } from '@src/core/ports/token-refresher';
import { NetworkError } from '@src/shared/errors/infra-error';
import { createAppLifecycleGatewayStub, createTestDi } from '@src/testing/core';
import { mockMethod } from '@src/testing/mock-method';
import { renderScreenHook } from '@src/testing/render';
import { onlineManager } from '@tanstack/react-query';
import { act } from '@testing-library/react-native';

import { usePendingRevocationFlush } from './use-pending-revocation-flush';

/** 오프라인 로그아웃으로 남은 해제 기록이 있고, 서버에 닿지 않아 기록이 계속 남는 기기 */
async function setup() {
  const appLifecycle = createAppLifecycleGatewayStub();
  const requestRefresh = mockMethod<RefreshTokensRequest>(async () => {
    throw new NetworkError();
  });
  const di = createTestDi({ ports: { appLifecycle, requestRefresh } });
  await di.sessionRevocationService.record('refresh-token');
  return { appLifecycle, requestRefresh, di };
}

describe('usePendingRevocationFlush', () => {
  beforeEach(() => {
    onlineManager.setOnline(true);
  });

  it('앱으로 돌아올 때마다 남은 세션 해제를 다시 시도한다', async () => {
    // Given
    const { appLifecycle, requestRefresh, di } = await setup();
    await renderScreenHook(() => usePendingRevocationFlush(), { di });
    requestRefresh.mockClear();

    // When
    await act(async () => appLifecycle.emit('background'));
    await act(async () => appLifecycle.emit('active'));

    // Then
    expect(requestRefresh).toHaveBeenCalledTimes(1);
  });

  it('이미 앞에 있는 동안 다시 active를 받아도 시도하지 않는다', async () => {
    // Given
    const { appLifecycle, requestRefresh, di } = await setup();
    await renderScreenHook(() => usePendingRevocationFlush(), { di });
    requestRefresh.mockClear();

    // When
    await act(async () => appLifecycle.emit('active'));

    // Then
    expect(requestRefresh).not.toHaveBeenCalled();
  });

  it('화면이 내려가면 앱 상태 구독을 끝낸다', async () => {
    // Given
    const { appLifecycle, di } = await setup();
    const { unmount } = await renderScreenHook(() => usePendingRevocationFlush(), { di });

    // When
    await unmount();

    // Then
    expect(appLifecycle.getListenerCount()).toBe(0);
  });
});

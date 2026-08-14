import { subscribeSessionExpired } from '@src/core/events/session-expired';
import type { SessionExpiredDetails } from '@src/core/ports/telemetry-event';
import { createMockTokenStore } from '@src/shared/__tests__';

import { createSessionManager } from './session-manager';

describe('createSessionManager', () => {
  let tokenStore: ReturnType<typeof createMockTokenStore>;
  let received: SessionExpiredDetails[];
  let unsubscribe: () => void;

  beforeEach(() => {
    tokenStore = createMockTokenStore();
    received = [];
    unsubscribe = subscribeSessionExpired((details) => received.push(details));
  });

  afterEach(() => {
    unsubscribe();
  });

  it('토큰을 지우고 만료 사유를 발행한다', async () => {
    // Given
    const sessionManager = createSessionManager(tokenStore);

    // When
    await sessionManager.end({ reason: 'refresh-rejected', serverErrorCode: 'SESSION_0704' });

    // Then
    expect(tokenStore.clear).toHaveBeenCalledTimes(1);
    expect(received).toEqual([{ reason: 'refresh-rejected', serverErrorCode: 'SESSION_0704' }]);
  });

  it('토큰 삭제가 실패해도 만료 이벤트는 발행한다', async () => {
    // Given — 잠긴 키체인 등으로 삭제가 실패해도 UI는 미인증으로 내려가야 한다
    tokenStore.clear.mockRejectedValue(new Error('keychain locked'));
    const sessionManager = createSessionManager(tokenStore);

    // When
    await expect(sessionManager.end({ reason: 'tokens-missing' })).rejects.toThrow(
      'keychain locked',
    );

    // Then
    expect(received).toEqual([{ reason: 'tokens-missing' }]);
  });

  it('삭제를 먼저 하고 그 다음에 발행한다', async () => {
    // Given — 발행이 먼저면 구독자가 토큰이 남은 상태를 관측한다
    const order: string[] = [];
    tokenStore.clear.mockImplementation(async () => {
      order.push('clear');
    });
    unsubscribe();
    unsubscribe = subscribeSessionExpired(() => order.push('emit'));
    const sessionManager = createSessionManager(tokenStore);

    // When
    await sessionManager.end({ reason: 'invalid-refresh-response' });

    // Then
    expect(order).toEqual(['clear', 'emit']);
  });
});

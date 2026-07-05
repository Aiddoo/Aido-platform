import { emitSessionExpired, subscribeSessionExpired } from './session-expired';

describe('session-expired 이벤트', () => {
  it('구독자에게 발행이 전달되어야 한다', () => {
    // Given
    const listener = jest.fn();
    const unsubscribe = subscribeSessionExpired(listener);

    // When
    emitSessionExpired();

    // Then
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('구독 해지 후에는 발행이 전달되지 않아야 한다', () => {
    // Given
    const listener = jest.fn();
    const unsubscribe = subscribeSessionExpired(listener);
    unsubscribe();

    // When
    emitSessionExpired();

    // Then
    expect(listener).not.toHaveBeenCalled();
  });

  it('여러 구독자에게 모두 전달되어야 한다', () => {
    // Given
    const first = jest.fn();
    const second = jest.fn();
    const unsubscribeFirst = subscribeSessionExpired(first);
    const unsubscribeSecond = subscribeSessionExpired(second);

    // When
    emitSessionExpired();

    // Then
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    unsubscribeFirst();
    unsubscribeSecond();
  });

  it('throw하는 리스너가 다른 리스너 알림을 막지 않아야 한다', () => {
    // Given
    const throwing = jest.fn(() => {
      throw new Error('listener failure');
    });
    const healthy = jest.fn();
    const unsubscribeThrowing = subscribeSessionExpired(throwing);
    const unsubscribeHealthy = subscribeSessionExpired(healthy);

    // When
    emitSessionExpired();

    // Then
    expect(healthy).toHaveBeenCalledTimes(1);
    unsubscribeThrowing();
    unsubscribeHealthy();
  });
});

import { emitNotificationsChanged, subscribeNotificationsChanged } from './notifications-changed';

describe('notifications-changed 이벤트', () => {
  it('던지는 리스너가 있어도 다른 리스너에게 알린다', () => {
    // Given
    const throwing = jest.fn(() => {
      throw new Error('listener failed');
    });
    const next = jest.fn();
    const unsubscribeThrowing = subscribeNotificationsChanged(throwing);
    const unsubscribeNext = subscribeNotificationsChanged(next);

    // When
    emitNotificationsChanged();

    // Then
    expect(next).toHaveBeenCalledTimes(1);
    unsubscribeThrowing();
    unsubscribeNext();
  });
});

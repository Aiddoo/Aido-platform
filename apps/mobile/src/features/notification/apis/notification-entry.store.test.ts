import { createNotificationEntryStore } from './notification-entry.store';

const tap = (id: string, actionIdentifier = 'default') => ({
  id,
  actionIdentifier,
  data: { notificationId: 1, type: 'FOLLOW_NEW', action: { type: 'DEEP_LINK' } } as const,
  receivedAt: 0,
});

describe('createNotificationEntryStore', () => {
  it('연속 두 탭은 마지막 탭만 슬롯에 남는다', () => {
    // Given
    const store = createNotificationEntryStore();

    // When
    store.receive(tap('a'));
    store.receive(tap('b'));

    // Then
    expect(store.getState().pending?.id).toBe('b');
  });

  it('끝난 응답이 다시 와도 슬롯에 넣지 않는다', () => {
    // Given
    const store = createNotificationEntryStore();
    store.receive(tap('a'));
    store.settle('a');

    // When
    store.receive(tap('a'));

    // Then
    expect(store.getState().pending).toBeNull();
  });

  it('수신 거부는 다음 탭에 밀리지 않는다', () => {
    // Given
    const store = createNotificationEntryStore();
    store.receive(tap('opt-out', 'MARKETING_OPT_OUT'));

    // When
    store.receive(tap('a'));

    // Then
    expect(store.getState().optOut?.id).toBe('opt-out');
    expect(store.getState().pending?.id).toBe('a');
  });

  it('같은 응답이 다시 오면 구독자를 깨우지 않는다', () => {
    // Given
    const store = createNotificationEntryStore();
    store.receive(tap('a'));
    const listener = jest.fn();
    store.subscribe(listener);

    // When
    store.receive(tap('a'));

    // Then
    expect(listener).not.toHaveBeenCalled();
  });
});

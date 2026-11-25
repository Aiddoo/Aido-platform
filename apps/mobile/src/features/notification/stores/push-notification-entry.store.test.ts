import { createPushNotificationResponse } from '../__tests__/notification.fixtures';
import { createPushNotificationEntryStore } from './push-notification-entry.store';

const tap = (id: string, actionIdentifier = 'default') =>
  createPushNotificationResponse({ id, actionIdentifier });

describe('createPushNotificationEntryStore', () => {
  it('연속 두 탭은 마지막 탭만 슬롯에 남는다', () => {
    // Given
    const store = createPushNotificationEntryStore();

    // When
    store.receive(tap('a'));
    store.receive(tap('b'));

    // Then
    expect(store.getSnapshot().pending?.id).toBe('b');
  });

  it('끝난 응답이 다시 와도 슬롯에 넣지 않는다', () => {
    // Given
    const store = createPushNotificationEntryStore();
    store.receive(tap('a'));
    store.settle('a');

    // When
    store.receive(tap('a'));

    // Then
    expect(store.getSnapshot().pending).toBeNull();
  });

  it('끝난 응답이 다른 탭 뒤에 다시 와도 슬롯에 넣지 않는다', () => {
    // Given
    const store = createPushNotificationEntryStore();
    store.receive(tap('a'));
    store.settle('a');
    store.receive(tap('b'));
    store.settle('b');

    // When
    store.receive(tap('a'));

    // Then
    expect(store.getSnapshot().pending).toBeNull();
  });

  it('최근 20개만 기억해 앱을 오래 써도 기억이 늘지 않는다', () => {
    // Given
    const store = createPushNotificationEntryStore();
    const responseIds = Array.from({ length: 21 }, (_, index) => `response-${index}`);
    for (const responseId of responseIds) {
      store.receive(tap(responseId));
      store.settle(responseId);
    }

    // When
    store.receive(tap('response-1'));
    const secondOldestPending = store.getSnapshot().pending?.id ?? null;
    store.receive(tap('response-0'));
    const oldestPending = store.getSnapshot().pending?.id ?? null;

    // Then
    expect(secondOldestPending).toBeNull();
    expect(oldestPending).toBe('response-0');
  });

  it('수신 거부는 다음 탭에 밀리지 않는다', () => {
    // Given
    const store = createPushNotificationEntryStore();
    store.receive(tap('opt-out', 'MARKETING_OPT_OUT'));

    // When
    store.receive(tap('a'));

    // Then
    expect(store.getSnapshot().optOut?.id).toBe('opt-out');
    expect(store.getSnapshot().pending?.id).toBe('a');
  });

  it('같은 응답이 다시 오면 구독자를 깨우지 않는다', () => {
    // Given
    const store = createPushNotificationEntryStore();
    store.receive(tap('a'));
    const listener = jest.fn();
    store.subscribe(listener);

    // When
    store.receive(tap('a'));

    // Then
    expect(listener).not.toHaveBeenCalled();
  });

  it('소유 확인이 끝나기 전에 새 탭이 오면 앞 탭의 목적지를 버린다', () => {
    // Given
    const store = createPushNotificationEntryStore();
    store.receive(tap('a'));
    store.receive(tap('b'));

    // When
    store.markReady('a', { kind: 'none' });

    // Then
    expect(store.getSnapshot().ready).toBeNull();
    expect(store.getSnapshot().pending?.id).toBe('b');
  });

  it('목적지가 정해진 뒤 새 탭이 오면 새 탭이 이긴다', () => {
    // Given
    const store = createPushNotificationEntryStore();
    store.receive(tap('a'));
    store.markReady('a', { kind: 'none' });

    // When
    store.receive(tap('b'));

    // Then
    expect(store.getSnapshot().ready).toBeNull();
    expect(store.getSnapshot().pending?.id).toBe('b');
  });
});

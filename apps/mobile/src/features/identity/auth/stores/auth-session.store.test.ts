import { createAuthSessionStore } from './auth-session.store';

describe('createAuthSessionStore', () => {
  it('전이 결과를 바로 읽을 수 있고 구독자에게 알린다', () => {
    // Given
    const store = createAuthSessionStore();
    const listener = jest.fn();
    store.subscribe(listener);

    // When
    store.dispatch({ type: 'bootResolved', status: 'authenticated' });

    // Then
    expect(store.getState()).toEqual({ status: 'authenticated' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('상태가 그대로면 다시 그리거나 정리를 반복하지 않게 알리지 않고 값도 바꾸지 않는다', () => {
    // Given
    const store = createAuthSessionStore({ status: 'unauthenticated', reason: 'signed-out' });
    const before = store.getState();
    const listener = jest.fn();
    store.subscribe(listener);

    // When
    store.dispatch({ type: 'signedOut' });
    store.dispatch({ type: 'sessionExpired' });

    // Then
    expect(listener).not.toHaveBeenCalled();
    expect(store.getState()).toBe(before);
  });

  it('구독을 끊으면 더 알리지 않는다', () => {
    // Given
    const store = createAuthSessionStore();
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);

    // When
    unsubscribe();
    store.dispatch({ type: 'signedIn' });

    // Then
    expect(listener).not.toHaveBeenCalled();
  });
});

import { renderScreenHook } from '@src/testing/render';
import { act } from '@testing-library/react-native';

import { createPushNotificationResponse } from '../__tests__/notification.fixtures';
import { useHasPendingPushNotificationEntry } from './use-push-notification-entry';

const RESPONSE = createPushNotificationResponse({
  id: 'response-1',
  isLaunchResponse: true,
  appState: 'active',
  activeSince: 0,
});

async function setup() {
  const hook = await renderScreenHook(() => useHasPendingPushNotificationEntry());
  return { store: hook.di.pushNotificationEntryStore, ...hook };
}

describe('useHasPendingPushNotificationEntry', () => {
  it('눌린 푸시가 열리기 전까지 대기 중이고 끝나면 풀린다', async () => {
    // Given
    const { store, result } = await setup();
    expect(result.current).toBe(false);

    // When
    await act(async () => store.receive(RESPONSE));

    // Then
    expect(result.current).toBe(true);

    // When
    await act(async () => store.markReady(RESPONSE.id, { kind: 'none' }));

    // Then
    expect(result.current).toBe(true);

    // When
    await act(async () => store.settle(RESPONSE.id));

    // Then
    expect(result.current).toBe(false);
  });
});

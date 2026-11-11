import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createTestDi } from '@src/testing/core';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { createPushNotificationResponse } from '../__tests__/notification.fixtures';
import { createPushNotificationEntryStore } from '../stores/push-notification-entry.store';
import { useHasPendingPushNotificationEntry } from './use-push-notification-entry';

const RESPONSE = createPushNotificationResponse({
  id: 'response-1',
  isLaunchResponse: true,
  appState: 'active',
  activeSince: 0,
});

async function setup() {
  const store = createPushNotificationEntryStore();
  const container = createTestDi({ pushNotificationEntryStore: store });
  const wrapper = ({ children }: PropsWithChildren) => (
    <StaticDIProvider container={container}>{children}</StaticDIProvider>
  );
  const hook = await renderHook(() => useHasPendingPushNotificationEntry(), { wrapper });
  return { store, ...hook };
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

import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createTestDi } from '@src/shared/__tests__';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { createNotificationEntryStore } from '../apis/notification-entry.store';
import type { PendingNotificationResponse } from '../domains/notification.model';
import { useHasPendingNotificationEntry } from './use-notification-entry';

const RESPONSE: PendingNotificationResponse = {
  id: 'response-1',
  actionIdentifier: 'default',
  data: { notificationId: 7, type: 'FOLLOW_NEW', action: { type: 'NONE' } },
  receivedAt: 0,
  isLaunchResponse: true,
  appState: 'active',
  activeSince: 0,
};

async function setup() {
  const store = createNotificationEntryStore();
  const container = createTestDi({ notificationEntryStore: store });
  const wrapper = ({ children }: PropsWithChildren) => (
    <StaticDIProvider container={container}>{children}</StaticDIProvider>
  );
  const hook = await renderHook(() => useHasPendingNotificationEntry(), { wrapper });
  return { store, ...hook };
}

describe('useHasPendingNotificationEntry', () => {
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

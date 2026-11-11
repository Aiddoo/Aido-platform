import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { toInstant } from '@src/shared/date/instant';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import { createMemorySyncStorage, createTestQueryClient } from '@src/testing/core';
// 생성된 typed routes가 없는 CI에서는 useSegments 반환이 [string]으로 좁아져 공용 mock의 jest.fn을 직접 쓴다
import { useSegments } from '@src/testing/mocks/expo-router';
import { renderScreenHook } from '@src/testing/render';
import { setupFakeTimersPerTest } from '@src/testing/timers';
import { act } from '@testing-library/react-native';
import { router } from 'expo-router';

import { createPendingRedemption } from '../__tests__/invite.fixtures';
import type { PendingRedemption } from '../domains/invite-redemption.model';
import { pendingRedemptionStoredValue } from '../schemas/pending-redemption-storage.schema';
import { useInviteAppEntry } from './use-invite-app-entry';

const NOW = new Date('2028-02-25T00:00:00Z');
const FRAME_MS = 16;

async function renderAppEntry(pending: PendingRedemption) {
  const syncStorage = createMemorySyncStorage();
  writeStoredValue(syncStorage, pendingRedemptionStoredValue, pending);
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser({ id: 'user-1' }));
  useSegments.mockReturnValue(['(app)', '(tabs)', 'feed']);

  await renderScreenHook(() => useInviteAppEntry(), {
    di: { syncStorage, authSessionStore: createAuthSessionStoreStub('authenticated') },
    queryClient,
  });
  await act(() => jest.advanceTimersByTimeAsync(FRAME_MS));

  return { syncStorage };
}

describe('useInviteAppEntry', () => {
  setupFakeTimersPerTest({ now: NOW });

  it('기한이 지난 초대는 열지 않고 기기에서 지운다', async () => {
    // When
    const { syncStorage } = await renderAppEntry(
      createPendingRedemption({ savedAt: toInstant('2028-02-10T00:00:00Z') }),
    );

    // Then
    expect(router.navigate).not.toHaveBeenCalled();
    expect(readStoredValue(syncStorage, pendingRedemptionStoredValue)).toBeNull();
  });

  it('기한 안의 초대는 초대 카드로 열고, 카드가 뜨기 전에 앱이 꺼져도 다시 열게 남겨 둔다', async () => {
    // Given
    const pending = createPendingRedemption({ savedAt: toInstant('2028-02-23T00:00:00Z') });

    // When
    const { syncStorage } = await renderAppEntry(pending);

    // Then
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/invite/[inviteCode]',
      params: { inviteCode: pending.inviteCode, source: pending.source },
    });
    expect(readStoredValue(syncStorage, pendingRedemptionStoredValue)).toEqual(pending);
  });
});

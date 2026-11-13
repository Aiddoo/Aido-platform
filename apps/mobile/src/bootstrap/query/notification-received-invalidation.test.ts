import { FRIEND_QUERY_KEYS } from '@src/features/social/friend/queries/friend-query-keys';
import { createTestQueryClient } from '@src/testing/core';

import { invalidateOnNotificationReceived } from './notification-received-invalidation';

describe('invalidateOnNotificationReceived', () => {
  it('친구 신청 알림은 친구 목록을 다시 받는다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(FRIEND_QUERY_KEYS.all, []);

    // When
    await invalidateOnNotificationReceived(queryClient, 'FOLLOW_NEW');

    // Then
    expect(queryClient.getQueryState(FRIEND_QUERY_KEYS.all)?.isInvalidated).toBe(true);
  });

  it('다른 기능과 상관없는 알림은 아무것도 다시 받지 않는다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(FRIEND_QUERY_KEYS.all, []);

    // When
    await invalidateOnNotificationReceived(queryClient, 'DAILY_COMPLETE');

    // Then
    expect(queryClient.getQueryState(FRIEND_QUERY_KEYS.all)?.isInvalidated).toBe(false);
  });
});

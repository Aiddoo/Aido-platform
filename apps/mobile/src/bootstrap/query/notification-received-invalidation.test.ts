import { FRIEND_QUERY_KEYS } from '@src/features/social/friend/queries/friend-query-keys';
import { createTestQueryClient } from '@src/testing/core';

import { invalidateOnNotificationReceived } from './notification-received-invalidation';

describe('invalidateOnNotificationReceived', () => {
  it('친구 신청 알림은 친구 목록을 다시 받는다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    // oxlint-disable-next-line aido/test-spy-target -- 1.15.2 전환 #1400
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');

    // When
    await invalidateOnNotificationReceived(queryClient, 'FOLLOW_NEW');

    // Then
    expect(invalidateQueries).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: FRIEND_QUERY_KEYS.all }),
    );
  });

  it('다른 기능과 상관없는 알림은 아무것도 다시 받지 않는다', async () => {
    // Given
    const queryClient = createTestQueryClient();
    // oxlint-disable-next-line aido/test-spy-target -- 1.15.2 전환 #1400
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries');

    // When
    await invalidateOnNotificationReceived(queryClient, 'DAILY_COMPLETE');

    // Then
    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});

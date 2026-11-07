import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import { FRIEND_QUERY_KEYS } from '@src/features/social/friend/constants/friend-query-keys';
import { createTestQueryClient } from '@src/shared/__tests__';
import type { QueryClient } from '@tanstack/react-query';

import { createInvite } from '../__tests__/invite.fixtures';
import { INVITE_QUERY_KEYS } from '../constants/invite-query-keys';
import {
  invalidateAfterRedeem,
  invalidateOnInviteNotification,
  replaceMyInvite,
} from './invite-cache';

function createQueryClient() {
  return createTestQueryClient();
}

describe('invite-cache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
  });

  describe('replaceMyInvite', () => {
    it('새 요약을 바로 넣고 이전 코드 미리보기를 지운다', () => {
      // Given
      const myInvite = createInvite({ code: 'B7TZ2N' });
      queryClient.setQueryData(INVITE_QUERY_KEYS.preview({ inviteCode: 'K7M2QX' }), {});

      // When
      replaceMyInvite(queryClient, myInvite);

      // Then
      expect(queryClient.getQueryData(INVITE_QUERY_KEYS.invite())).toEqual(myInvite);
      expect(queryClient.getQueryData(INVITE_QUERY_KEYS.preview({ inviteCode: 'K7M2QX' }))).toBe(
        undefined,
      );
    });
  });

  describe('invalidateInvite', () => {});

  describe('invalidateAfterRedeem', () => {
    it('친구·요청 목록과 내 정보를 다시 불러오고 쓴 코드의 미리보기를 지운다', async () => {
      // Given
      const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
      queryClient.setQueryData(INVITE_QUERY_KEYS.preview({ inviteCode: 'K7M2QX' }), {});

      // When
      await invalidateAfterRedeem(queryClient, { inviteCode: 'K7M2QX' });

      // Then
      expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
        FRIEND_QUERY_KEYS.all,
        USER_QUERY_KEYS.me(),
      ]);
      expect(queryClient.getQueryData(INVITE_QUERY_KEYS.preview({ inviteCode: 'K7M2QX' }))).toBe(
        undefined,
      );
    });
  });

  describe('invalidateOnInviteNotification', () => {
    it('초대 요약·초대한 친구 목록, 친구 목록과 내 정보를 다시 불러오게 한다', async () => {
      // Given
      const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

      // When
      await invalidateOnInviteNotification(queryClient);

      // Then
      expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
        INVITE_QUERY_KEYS.invite(),
        INVITE_QUERY_KEYS.inviteeLists(),
        FRIEND_QUERY_KEYS.all,
        USER_QUERY_KEYS.me(),
      ]);
    });
  });

  describe('storeRedemptionResult', () => {});
});

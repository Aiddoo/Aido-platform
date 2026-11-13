import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { FRIEND_QUERY_KEYS } from '@src/features/social/friend/queries/friend-query-keys';
import { createTestQueryClient } from '@src/testing/core';
import type { QueryClient } from '@tanstack/react-query';

import { createInvite } from '../__tests__/invite.fixtures';
import {
  invalidateAfterRedeem,
  invalidateOnInviteNotification,
  replaceMyInvite,
} from './invite-cache';
import { INVITE_QUERY_KEYS } from './invite-query-keys';

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
      queryClient.setQueryData(INVITE_QUERY_KEYS.preview({ inviteCode: 'K7M2QX' }), {
        inviter: { name: null, profileImage: null },
      });

      // When
      replaceMyInvite(queryClient, myInvite);

      // Then
      expect(queryClient.getQueryData(INVITE_QUERY_KEYS.me())).toEqual(myInvite);
      expect(
        queryClient.getQueryData(INVITE_QUERY_KEYS.preview({ inviteCode: 'K7M2QX' })),
      ).toBeUndefined();
    });
  });

  describe('invalidateAfterRedeem', () => {
    it('친구·요청 목록과 내 정보를 다시 불러오고 쓴 코드의 미리보기를 지운다', async () => {
      // Given
      queryClient.setQueryData(INVITE_QUERY_KEYS.preview({ inviteCode: 'K7M2QX' }), {
        inviter: { name: null, profileImage: null },
      });
      queryClient.setQueryData(FRIEND_QUERY_KEYS.all, []);
      queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser());

      // When
      await invalidateAfterRedeem(queryClient, { inviteCode: 'K7M2QX' });

      // Then
      expect(queryClient.getQueryState(FRIEND_QUERY_KEYS.all)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(USER_QUERY_KEYS.me())?.isInvalidated).toBe(true);
      expect(
        queryClient.getQueryData(INVITE_QUERY_KEYS.preview({ inviteCode: 'K7M2QX' })),
      ).toBeUndefined();
    });
  });

  describe('invalidateOnInviteNotification', () => {
    it('초대 요약·초대한 친구 목록, 친구 목록과 내 정보를 다시 불러오게 한다', async () => {
      // Given
      queryClient.setQueryData(INVITE_QUERY_KEYS.me(), createInvite());
      queryClient.setQueryData(INVITE_QUERY_KEYS.invitees({}), { pages: [], pageParams: [] });
      queryClient.setQueryData(FRIEND_QUERY_KEYS.all, []);
      queryClient.setQueryData(USER_QUERY_KEYS.me(), createUser());

      // When
      await invalidateOnInviteNotification(queryClient);

      // Then
      const keys = [
        INVITE_QUERY_KEYS.me(),
        INVITE_QUERY_KEYS.invitees({}),
        FRIEND_QUERY_KEYS.all,
        USER_QUERY_KEYS.me(),
      ];
      expect(keys.map((key) => queryClient.getQueryState(key)?.isInvalidated)).toEqual([
        true,
        true,
        true,
        true,
      ]);
    });
  });
});

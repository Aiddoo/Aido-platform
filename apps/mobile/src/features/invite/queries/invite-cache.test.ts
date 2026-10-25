import { FRIEND_QUERY_KEYS } from '@src/features/friend/constants/friend-query-keys';
import { USER_QUERY_KEYS } from '@src/features/user/constants/user-query-keys';
import { QueryClient } from '@tanstack/react-query';

import { createInvite, createRedemptionResult } from '../__tests__/invite.factories';
import { INVITE_QUERY_KEYS } from '../constants/invite-query-keys';
import {
  invalidateAfterRedeem,
  replaceMyInvite,
  invalidateInvite,
  storeRedemptionResult,
} from './invite-cache';

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
}

describe('invite-cache', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
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

  describe('invalidateInvite', () => {
    it('내 초대 요약과 초대한 친구 목록을 다시 불러오게 한다', async () => {
      // Given
      const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

      // When
      await invalidateInvite(queryClient);

      // Then
      expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
        INVITE_QUERY_KEYS.invite(),
        INVITE_QUERY_KEYS.inviteeLists(),
      ]);
    });
  });

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

  describe('storeRedemptionResult', () => {
    it('초대한 사람 id로 수락 결과를 남긴다', () => {
      // Given
      const result = createRedemptionResult();

      // When
      storeRedemptionResult(queryClient, result);

      // Then
      expect(
        queryClient.getQueryData(
          INVITE_QUERY_KEYS.redemption({ inviterId: result.inviter.userId }),
        ),
      ).toEqual(result);
    });
  });
});

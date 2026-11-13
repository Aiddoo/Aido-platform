import { toInstant } from '@src/shared/date/instant';
import { createHttpClientStub } from '@src/testing/core';

import { createInvitedFriendDto, createInviteDto } from '../__tests__/invite.fixtures';
import { InviteApi } from './invite.api';

function createApi() {
  const publicHttpClient = createHttpClientStub();
  const authHttpClient = createHttpClientStub();
  return {
    api: new InviteApi({ publicHttpClient, authHttpClient }),
    publicHttpClient,
    authHttpClient,
  };
}

describe('InviteApi', () => {
  describe('getAvailability', () => {
    it('초대 기능 사용 가능 여부를 반환한다', async () => {
      // Given
      const { api, publicHttpClient } = createApi();
      publicHttpClient.get.mockResolvedValue({ ok: true, value: { enabled: false } });

      // When
      const result = await api.getAvailability();

      // Then
      expect(publicHttpClient.get).toHaveBeenCalledWith('v1/invites/availability', {
        signal: undefined,
      });
      expect(result).toEqual({ ok: true, value: false });
    });
  });

  describe('getInvite', () => {
    it('발급 시각을 순간으로 바꾼 내 초대 요약을 반환한다', async () => {
      // Given
      const { api, authHttpClient } = createApi();
      authHttpClient.get.mockResolvedValue({ ok: true, value: createInviteDto() });

      // When
      const result = await api.getInvite();

      // Then
      expect(authHttpClient.get).toHaveBeenCalledWith('v1/invites/me', { signal: undefined });
      expect(result.ok && result.value.createdAt).toEqual(toInstant('2026-11-01T09:00:00.000Z'));
    });

    it('모르는 보상 종류가 오면 UNKNOWN으로 바꿔 반환한다', async () => {
      // Given
      const { api, authHttpClient } = createApi();
      authHttpClient.get.mockResolvedValue({
        ok: true,
        value: {
          ...createInviteDto(),
          rewardsEarned: [
            { rewardType: 'PREMIUM_DAYS', quantity: 7 },
            { rewardType: 'BADGE', quantity: 1 },
          ],
        },
      });

      // When
      const result = await api.getInvite();

      // Then
      expect(result.ok && result.value.rewardsEarned).toEqual([
        { rewardType: 'PREMIUM_DAYS', quantity: 7 },
        { rewardType: 'UNKNOWN', quantity: 0 },
      ]);
    });

    it.each([
      ['상한 상태가 없는 이전 서버', undefined],
      ['앱이 모르는 새 상한 상태', 'PAUSED'],
    ])('%s 응답이면 상한을 AVAILABLE로 읽어 반환한다', async (_case, premiumCapState) => {
      // Given
      const { api, authHttpClient } = createApi();
      const { premiumCapState: _omitted, ...previousDto } = createInviteDto();
      authHttpClient.get.mockResolvedValue({
        ok: true,
        value: premiumCapState == null ? previousDto : { ...previousDto, premiumCapState },
      });

      // When
      const result = await api.getInvite();

      // Then
      expect(result.ok && result.value.premiumCapState).toBe('AVAILABLE');
    });

    it('서버가 누적 상한을 보내면 그대로 반환한다', async () => {
      // Given
      // 출시 전에 이미 상한에 닿은 사용자도 첫 조회에서 상한 상태를 받는다
      const { api, authHttpClient } = createApi();
      authHttpClient.get.mockResolvedValue({
        ok: true,
        value: createInviteDto({ premiumCapState: 'TOTAL_REACHED', totalPremiumDays: 90 }),
      });

      // When
      const result = await api.getInvite();

      // Then
      expect(result.ok && result.value.premiumCapState).toBe('TOTAL_REACHED');
    });
  });

  describe('getInvitedFriends', () => {
    it('cursor로 다음 페이지를 불러와 날짜를 순간으로 바꾼 목록을 반환한다', async () => {
      // Given
      const { api, authHttpClient } = createApi();
      authHttpClient.get.mockResolvedValue({
        ok: true,
        value: { items: [createInvitedFriendDto()], totalCount: 3, hasMore: true },
      });

      // When
      const result = await api.getInvitedFriends({ cursor: 'clz7x5p8k0004qz0z8z8z8z8z' });

      // Then
      expect(authHttpClient.get).toHaveBeenCalledWith('v1/invites/me/invitees', {
        signal: undefined,
        params: { cursor: 'clz7x5p8k0004qz0z8z8z8z8z', limit: undefined, status: undefined },
      });
      expect(result.ok && result.value.items[0]?.joinedAt).toEqual(
        toInstant('2026-11-02T10:30:00.000Z'),
      );
      expect(result.ok && result.value.nextCursor).toBe('clz7x5p8k0005qz0z8z8z8z8z');
    });
  });
});

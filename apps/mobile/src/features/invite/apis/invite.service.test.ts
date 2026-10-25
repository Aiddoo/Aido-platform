import { createMemorySyncStorage, createMockHttpClient } from '@src/shared/__tests__';
import { ParseError } from '@src/shared/errors/infra-error';

import {
  createInviteApiError,
  createInvitedFriendDto,
  createInvitePreviewDto,
  createInviteDto,
  createPendingRedemption,
  INVALID_DTO,
} from '../__tests__/invite.factories';
import { isInviteError } from '../domains/invite.error';
import { createAllDoneBannerRepository } from './all-done-banner.repository';
import { createInstallReferrerRepository } from './install-referrer.repository';
import { InviteService } from './invite.service';
import { createPawPrintCelebrationRepository } from './paw-print-celebration.repository';
import { createPendingRedemptionRepository } from './pending-redemption.repository';

function createService({ referrer = null }: { referrer?: string | null } = {}) {
  const publicHttpClient = createMockHttpClient();
  const authHttpClient = createMockHttpClient();
  const storage = createMemorySyncStorage();
  const readReferrer = jest.fn().mockResolvedValue(referrer);
  const pendingRedemptionRepository = createPendingRedemptionRepository(storage);
  const service = new InviteService({
    publicHttpClient,
    authHttpClient,
    pendingRedemptionRepository,
    installReferrerRepository: createInstallReferrerRepository(storage, { read: readReferrer }),
    pawPrintCelebrationRepository: createPawPrintCelebrationRepository(storage),
    installationIdGateway: { get: () => Promise.resolve('6F9619FF-8B86-D011-B42D-00C04FC964FF') },
    allDoneBannerRepository: createAllDoneBannerRepository(storage),
  });

  return { service, publicHttpClient, authHttpClient, pendingRedemptionRepository, readReferrer };
}

describe('InviteService', () => {
  describe('getPreview', () => {
    it('정규화한 코드로 공개 미리보기를 불러와 초대한 사람을 반환한다', async () => {
      // Given
      const { service, publicHttpClient } = createService();
      publicHttpClient.get.mockResolvedValue({ ok: true, value: createInvitePreviewDto() });

      // When
      const result = await service.getPreview('k7m2-qx');

      // Then
      expect(publicHttpClient.get).toHaveBeenCalledWith('v1/invites/K7M2QX', {
        signal: undefined,
      });
      expect(result).toEqual({
        ok: true,
        value: { inviter: { name: '민지', profileImage: 'orange_tabby' } },
      });
    });

    it('형식이 틀린 코드면 요청하지 않고 InviteError를 반환한다', async () => {
      // Given
      const { service, publicHttpClient } = createService();

      // When
      const result = await service.getPreview('K7M2Q0');

      // Then
      expect(publicHttpClient.get).not.toHaveBeenCalled();
      expect(result.ok).toBe(false);
      expect(!result.ok && isInviteError(result.error)).toBe(true);
    });

    it('서버가 4xx로 답하면 Result.err로 그대로 반환한다', async () => {
      // Given
      const { service, publicHttpClient } = createService();
      const apiError = createInviteApiError({ code: 'INVITE_2102', status: 410 });
      publicHttpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getPreview('K7M2QX');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('응답 형식이 계약과 다르면 ParseError를 던진다', async () => {
      // Given
      const { service, publicHttpClient } = createService();
      publicHttpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.getPreview('K7M2QX')).rejects.toBeInstanceOf(ParseError);
    });
  });

  describe('getAvailability', () => {
    it('초대 기능 사용 가능 여부를 반환한다', async () => {
      // Given
      const { service, publicHttpClient } = createService();
      publicHttpClient.get.mockResolvedValue({ ok: true, value: { enabled: false } });

      // When
      const result = await service.getAvailability();

      // Then
      expect(publicHttpClient.get).toHaveBeenCalledWith('v1/invites/availability', {
        signal: undefined,
      });
      expect(result).toEqual({ ok: true, value: false });
    });
  });

  describe('redeem', () => {
    it('설치 식별자와 함께 수락하고 모르는 보상 종류는 UNKNOWN으로 바꿔 반환한다', async () => {
      // Given
      const { service, authHttpClient } = createService();
      authHttpClient.post.mockResolvedValue({
        ok: true,
        value: {
          outcome: 'REDEEMED',
          inviter: {
            userId: 'clz7x5p8k0001qz0z8z8z8z8z',
            name: '민지',
            userTag: 'K3MQ9XWA',
            profileImage: 'orange_tabby',
          },
          friendship: 'FRIENDS',
          rewards: [
            { rewardType: 'PREMIUM_DAYS', quantity: 7 },
            { rewardType: 'BADGE', quantity: 1 },
          ],
        },
      });

      // When
      const result = await service.redeem('k7m2qx');

      // Then
      expect(authHttpClient.post).toHaveBeenCalledWith('v1/invites/K7M2QX/redeem', {
        installationId: '6F9619FF-8B86-D011-B42D-00C04FC964FF',
      });
      expect(result.ok && result.value.outcome === 'REDEEMED' && result.value.rewards).toEqual([
        { rewardType: 'PREMIUM_DAYS', quantity: 7 },
        { rewardType: 'UNKNOWN', quantity: 0 },
      ]);
    });

    it('서버가 4xx로 답하면 Result.err로 그대로 반환한다', async () => {
      // Given
      const { service, authHttpClient } = createService();
      const apiError = createInviteApiError({ code: 'INVITE_2103', status: 400 });
      authHttpClient.post.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.redeem('K7M2QX');

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('응답 형식이 계약과 다르면 ParseError를 던진다', async () => {
      // Given
      const { service, authHttpClient } = createService();
      authHttpClient.post.mockResolvedValue({ ok: true, value: { outcome: 'UNKNOWN' } });

      // When & Then
      await expect(service.redeem('K7M2QX')).rejects.toBeInstanceOf(ParseError);
    });
  });

  describe('getInvite', () => {
    it('발급 시각을 Date로 바꾼 내 초대 요약을 반환한다', async () => {
      // Given
      const { service, authHttpClient } = createService();
      authHttpClient.get.mockResolvedValue({ ok: true, value: createInviteDto() });

      // When
      const result = await service.getInvite();

      // Then
      expect(authHttpClient.get).toHaveBeenCalledWith('v1/invites/me', { signal: undefined });
      expect(result.ok && result.value.createdAt).toEqual(new Date('2026-11-01T09:00:00.000Z'));
    });

    it('모르는 보상 종류가 오면 UNKNOWN으로 바꿔 반환한다', async () => {
      // Given
      const { service, authHttpClient } = createService();
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
      const result = await service.getInvite();

      // Then
      expect(result.ok && result.value.rewardsEarned).toEqual([
        { rewardType: 'PREMIUM_DAYS', quantity: 7 },
        { rewardType: 'UNKNOWN', quantity: 0 },
      ]);
    });

    it('서버가 4xx로 답하면 Result.err로 그대로 반환한다', async () => {
      // Given
      const { service, authHttpClient } = createService();
      const apiError = createInviteApiError({ code: 'INVITE_2105', status: 403 });
      authHttpClient.get.mockResolvedValue({ ok: false, error: apiError });

      // When
      const result = await service.getInvite();

      // Then
      expect(result).toEqual({ ok: false, error: apiError });
    });

    it('응답 형식이 계약과 다르면 ParseError를 던진다', async () => {
      // Given
      const { service, authHttpClient } = createService();
      authHttpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When & Then
      await expect(service.getInvite()).rejects.toBeInstanceOf(ParseError);
    });
  });

  describe('getInvitedFriends', () => {
    it('cursor로 다음 페이지를 불러와 날짜를 Date로 바꾼 목록을 반환한다', async () => {
      // Given
      const { service, authHttpClient } = createService();
      authHttpClient.get.mockResolvedValue({
        ok: true,
        value: { items: [createInvitedFriendDto()], totalCount: 3, hasMore: true },
      });

      // When
      const result = await service.getInvitedFriends({ cursor: 'clz7x5p8k0004qz0z8z8z8z8z' });

      // Then
      expect(authHttpClient.get).toHaveBeenCalledWith('v1/invites/me/invitees', {
        signal: undefined,
        params: { cursor: 'clz7x5p8k0004qz0z8z8z8z8z', limit: undefined, status: undefined },
      });
      expect(result.ok && result.value.items[0]?.joinedAt).toEqual(
        new Date('2026-11-02T10:30:00.000Z'),
      );
      expect(result.ok && result.value.hasMore).toBe(true);
    });
  });

  describe('findPendingRedemption', () => {
    it('7일 안에 저장한 초대면 지우지 않고 반환한다', () => {
      // Given
      const { service, pendingRedemptionRepository } = createService();
      const pending = createPendingRedemption({ savedAt: new Date('2026-10-20T00:00:00Z') });
      pendingRedemptionRepository.save(pending);

      // When
      const result = service.findPendingRedemption(new Date('2026-10-25T00:00:00Z'));

      // Then 10-20 → 10-25 = 5일 ≤ 7일
      expect(result).toEqual(pending);
      expect(pendingRedemptionRepository.get()).toEqual(pending);
    });

    it('7일이 지난 초대면 null을 반환하고 지운다', () => {
      // Given
      const { service, pendingRedemptionRepository } = createService();
      pendingRedemptionRepository.save(
        createPendingRedemption({ savedAt: new Date('2026-10-10T00:00:00Z') }),
      );

      // When
      const result = service.findPendingRedemption(new Date('2026-10-25T00:00:00Z'));

      // Then 10-10 → 10-25 = 15일 > 7일
      expect(result).toBeNull();
      expect(pendingRedemptionRepository.get()).toBeNull();
    });
  });

  describe('clearPendingRedemption', () => {
    it('이어서 열 초대를 지운다', () => {
      // Given
      const { service, pendingRedemptionRepository } = createService();
      pendingRedemptionRepository.save(createPendingRedemption());

      // When
      service.clearPendingRedemption();

      // Then
      expect(pendingRedemptionRepository.get()).toBeNull();
    });
  });

  describe('captureInstallReferrer', () => {
    it('처음 실행이고 referrer에 초대 코드가 있으면 이어서 열 초대로 남긴다', async () => {
      // Given
      const { service, pendingRedemptionRepository } = createService({
        referrer: 'inviteCode=K7M2QX&utm_source=aido_landing',
      });
      const now = new Date('2026-10-25T00:00:00Z');

      // When
      const result = await service.captureInstallReferrer(now);

      // Then
      const expected = createPendingRedemption({ source: 'install_referrer', savedAt: now });
      expect(result).toEqual(expected);
      expect(pendingRedemptionRepository.get()).toEqual(expected);
    });

    it('이미 한 번 확인했으면 referrer를 다시 읽지 않는다', async () => {
      // Given
      const { service, readReferrer } = createService({ referrer: 'inviteCode=K7M2QX' });
      await service.captureInstallReferrer(new Date('2026-10-25T00:00:00Z'));

      // When
      const result = await service.captureInstallReferrer(new Date('2026-10-26T00:00:00Z'));

      // Then
      expect(result).toBeNull();
      expect(readReferrer).toHaveBeenCalledTimes(1);
    });
  });
});

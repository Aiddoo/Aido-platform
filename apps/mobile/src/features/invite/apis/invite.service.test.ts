import { createMemorySyncStorage, createMockHttpClient } from '@src/shared/__tests__';
import { ParseError } from '@src/shared/errors/infra-error';

import {
  createInviteApiError,
  createInvitePreviewDto,
  createPendingRedemption,
  INVALID_DTO,
} from '../__tests__/invite.factories';
import { isInviteError } from '../domains/invite.error';
import { createInstallReferrerRepository } from './install-referrer.repository';
import { InviteService } from './invite.service';
import { createPendingRedemptionRepository } from './pending-redemption.repository';

function createService({ referrer = null }: { referrer?: string | null } = {}) {
  const publicHttpClient = createMockHttpClient();
  const storage = createMemorySyncStorage();
  const readReferrer = jest.fn().mockResolvedValue(referrer);
  const pendingRedemptionRepository = createPendingRedemptionRepository(storage);
  const service = new InviteService({
    publicHttpClient,
    pendingRedemptionRepository,
    installReferrerRepository: createInstallReferrerRepository(storage, { read: readReferrer }),
  });

  return { service, publicHttpClient, pendingRedemptionRepository, readReferrer };
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

  describe('takePendingRedemption', () => {
    it('7일 안에 저장한 초대면 반환하고 지운다', () => {
      // Given
      const { service, pendingRedemptionRepository } = createService();
      const pending = createPendingRedemption({ savedAt: new Date('2026-10-20T00:00:00Z') });
      pendingRedemptionRepository.save(pending);

      // When
      const result = service.takePendingRedemption(new Date('2026-10-25T00:00:00Z'));

      // Then
      expect(result).toEqual(pending);
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

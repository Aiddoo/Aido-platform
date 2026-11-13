import { ParseError } from '@src/shared/errors/infra-error';
import { readStoredValue, writeStoredValue } from '@src/shared/storage/define-stored-value';
import {
  createHttpClientStub,
  createAppLoggerStub,
  createMemorySyncStorage,
} from '@src/testing/core';

import {
  createInviteApiError,
  createInvitePreviewDto,
  createPendingRedemption,
  INVALID_DTO,
} from '../__tests__/invite.fixtures';
import { InviteApi } from '../apis/invite.api';
import { INVITE_ERROR_CODE } from '../domains/invite.error';
import { pendingRedemptionStoredValue } from '../schemas/pending-redemption-storage.schema';
import { InviteService } from './invite.service';
import { PendingRedemptionService } from './pending-redemption.service';

function createService({
  referrer,
  readInstallationId = () => Promise.resolve('6F9619FF-8B86-D011-B42D-00C04FC964FF'),
}: {
  referrer?: string;
  readInstallationId?: () => Promise<string | null>;
} = {}) {
  const publicHttpClient = createHttpClientStub();
  const authHttpClient = createHttpClientStub();
  const storage = createMemorySyncStorage();
  const readReferrer = jest.fn().mockResolvedValue(referrer ?? null);
  const logger = createAppLoggerStub();
  const pendingRedemptionService = new PendingRedemptionService(storage, { get: readReferrer });
  const service = new InviteService({
    inviteApi: new InviteApi({ publicHttpClient, authHttpClient }),
    pendingRedemptionService,
    installationId: { get: readInstallationId },
    logger,
  });

  return {
    service,
    publicHttpClient,
    authHttpClient,
    storage,
    readReferrer,
    logger,
  };
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

    it('형식이 틀린 코드면 요청하지 않고 INVALID_CODE 오류를 반환한다', async () => {
      // Given
      const { service, publicHttpClient } = createService();

      // When
      const result = await service.getPreview('K7M2Q0');

      // Then
      expect(publicHttpClient.get).not.toHaveBeenCalled();
      expect(result.ok).toBe(false);
      expect(!result.ok && result.error.code === INVITE_ERROR_CODE.INVALID_CODE).toBe(true);
    });

    it('응답 형식이 계약과 다르면 ParseError를 던진다', async () => {
      // Given
      const { service, publicHttpClient } = createService();
      publicHttpClient.get.mockResolvedValue({ ok: true, value: INVALID_DTO });

      // When

      const result = service.getPreview('K7M2QX');

      // Then

      await expect(result).rejects.toBeInstanceOf(ParseError);
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
          isReplay: false,
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

    it('설치 식별자를 읽지 못하면 경고를 남기고 식별자 없이 수락한다', async () => {
      // Given
      const { service, authHttpClient, logger } = createService({
        readInstallationId: () => Promise.reject(new Error('keychain locked')),
      });
      authHttpClient.post.mockResolvedValue({
        ok: false,
        error: createInviteApiError({ code: 'INVITE_2103', status: 400 }),
      });

      // When
      await service.redeem('K7M2QX');

      // Then
      expect(authHttpClient.post).toHaveBeenCalledWith('v1/invites/K7M2QX/redeem', {});
      expect(logger.warn).toHaveBeenCalledWith('invite.installation-id-read.failed', {
        error: 'keychain locked',
      });
    });
  });

  describe('미리보기 실패와 기기에 남긴 초대', () => {
    it('이어서 열려던 초대가 없어졌으면 기기에 남긴 초대를 지운다', async () => {
      // Given
      const { service, publicHttpClient, storage } = createService();
      writeStoredValue(
        storage,
        pendingRedemptionStoredValue,
        createPendingRedemption({ inviteCode: 'K7M2QX' }),
      );
      publicHttpClient.get.mockResolvedValue({
        ok: false,
        error: createInviteApiError({ code: 'INVITE_2102', status: 410 }),
      });

      // When
      await service.getPreview('K7M2QX');

      // Then
      expect(readStoredValue(storage, pendingRedemptionStoredValue)).toBeNull();
    });

    it('다른 코드의 실패나 일시 오류는 기기에 남긴 초대를 지우지 않는다', async () => {
      // Given
      const { service, publicHttpClient, storage } = createService();
      const pending = createPendingRedemption({ inviteCode: 'K7M2QX' });
      writeStoredValue(storage, pendingRedemptionStoredValue, pending);
      publicHttpClient.get
        .mockResolvedValueOnce({
          ok: false,
          error: createInviteApiError({ code: 'INVITE_2102', status: 410 }),
        })
        .mockResolvedValueOnce({
          ok: false,
          error: createInviteApiError({ code: 'INVITE_2105', status: 403 }),
        });

      // When
      await service.getPreview('BCDF23');
      await service.getPreview('K7M2QX');

      // Then
      expect(readStoredValue(storage, pendingRedemptionStoredValue)).toEqual(pending);
    });
  });
});

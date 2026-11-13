import { toInstant } from '@src/shared/date/instant';
import { readStoredValue } from '@src/shared/storage/define-stored-value';
import { createMemorySyncStorage } from '@src/testing/core';

import { createPendingRedemption } from '../__tests__/invite.fixtures';
import { pendingRedemptionStoredValue } from '../schemas/pending-redemption-storage.schema';
import { PendingRedemptionService } from './pending-redemption.service';

function createService({ referrer }: { referrer?: string } = {}) {
  const storage = createMemorySyncStorage();
  const readReferrer = jest.fn().mockResolvedValue(referrer ?? null);
  const service = new PendingRedemptionService(storage, { get: readReferrer });

  return { service, storage, readReferrer };
}

describe('PendingRedemptionService', () => {
  describe('captureInstallReferrer', () => {
    it('처음 실행이고 referrer에 초대 코드가 있으면 이어서 열 초대로 남긴다', async () => {
      // Given
      const { service, storage } = createService({
        referrer: 'inviteCode=K7M2QX&utm_source=aido_landing',
      });
      const now = toInstant('2026-10-25T00:00:00Z');

      // When
      const result = await service.captureInstallReferrer(now);

      // Then
      const expected = createPendingRedemption({ source: 'install_referrer', savedAt: now });
      expect(result).toEqual(expected);
      expect(readStoredValue(storage, pendingRedemptionStoredValue)).toEqual(expected);
    });

    it('이미 한 번 확인했으면 referrer를 다시 읽지 않는다', async () => {
      // Given
      const { service, readReferrer } = createService({ referrer: 'inviteCode=K7M2QX' });
      await service.captureInstallReferrer(toInstant('2026-10-25T00:00:00Z'));

      // When
      const result = await service.captureInstallReferrer(toInstant('2026-10-26T00:00:00Z'));

      // Then
      expect(result).toBeNull();
      expect(readReferrer).toHaveBeenCalledTimes(1);
    });

    it('출시된 앱이 남긴 확인 표시(원문 1)가 있으면 referrer를 읽지 않는다', async () => {
      // Given
      const { service, storage, readReferrer } = createService({ referrer: 'inviteCode=K7M2QX' });
      storage.set('aido_install_referrer_checked_v1', '1');

      // When
      const result = await service.captureInstallReferrer(toInstant('2026-10-25T00:00:00Z'));

      // Then
      expect(result).toBeNull();
      expect(readReferrer).not.toHaveBeenCalled();
    });
  });
});

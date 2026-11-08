import { createMemorySyncStorage } from '@src/shared/__tests__';
import { toInstant } from '@src/shared/date/instant';

import { createPendingRedemption } from '../__tests__/invite.fixtures';
import { createInstallReferrerRepository } from './install-referrer.repository';
import { createPendingRedemptionRepository } from './pending-redemption.repository';
import { PendingRedemptionService } from './pending-redemption.service';

function createService({ referrer = null }: { referrer?: string | null } = {}) {
  const storage = createMemorySyncStorage();
  const readReferrer = jest.fn().mockResolvedValue(referrer);
  const pendingRedemptionRepository = createPendingRedemptionRepository(storage);
  const service = new PendingRedemptionService({
    pendingRedemptionRepository,
    installReferrerRepository: createInstallReferrerRepository(storage),
    installReferrerGateway: { get: readReferrer },
  });

  return { service, pendingRedemptionRepository, readReferrer };
}

describe('PendingRedemptionService', () => {
  describe('findFreshPendingRedemption', () => {
    it('7일 안에 저장한 초대면 지우지 않고 반환한다', () => {
      // Given
      const { service, pendingRedemptionRepository } = createService();
      const pending = createPendingRedemption({ savedAt: toInstant('2026-10-20T00:00:00Z') });
      pendingRedemptionRepository.save(pending);

      // When
      const result = service.findFreshPendingRedemption(toInstant('2026-10-25T00:00:00Z'));

      // Then

      // 10-20 → 10-25 = 5일 ≤ 7일
      expect(result).toEqual(pending);
      expect(pendingRedemptionRepository.find()).toEqual(pending);
    });

    it('7일이 지난 초대면 null을 반환하고 저장소는 그대로 둔다', () => {
      // Given
      const { service, pendingRedemptionRepository } = createService();
      const pending = createPendingRedemption({ savedAt: toInstant('2026-10-10T00:00:00Z') });
      pendingRedemptionRepository.save(pending);

      // When
      const result = service.findFreshPendingRedemption(toInstant('2026-10-25T00:00:00Z'));

      // Then

      // 10-10 → 10-25 = 15일 > 7일
      expect(result).toBeNull();
      expect(pendingRedemptionRepository.find()).toEqual(pending);
    });
  });

  describe('discardStalePendingRedemption', () => {
    it('7일이 지난 초대는 지운다', () => {
      // Given
      const { service, pendingRedemptionRepository } = createService();
      pendingRedemptionRepository.save(
        createPendingRedemption({ savedAt: toInstant('2026-10-10T00:00:00Z') }),
      );

      // When
      service.discardStalePendingRedemption(toInstant('2026-10-25T00:00:00Z'));

      // Then
      expect(pendingRedemptionRepository.find()).toBeNull();
    });

    it('7일 안에 저장한 초대는 지우지 않는다', () => {
      // Given
      const { service, pendingRedemptionRepository } = createService();
      const pending = createPendingRedemption({ savedAt: toInstant('2026-10-20T00:00:00Z') });
      pendingRedemptionRepository.save(pending);

      // When
      service.discardStalePendingRedemption(toInstant('2026-10-25T00:00:00Z'));

      // Then
      expect(pendingRedemptionRepository.find()).toEqual(pending);
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
      expect(pendingRedemptionRepository.find()).toBeNull();
    });
  });

  describe('captureInstallReferrer', () => {
    it('처음 실행이고 referrer에 초대 코드가 있으면 이어서 열 초대로 남긴다', async () => {
      // Given
      const { service, pendingRedemptionRepository } = createService({
        referrer: 'inviteCode=K7M2QX&utm_source=aido_landing',
      });
      const now = toInstant('2026-10-25T00:00:00Z');

      // When
      const result = await service.captureInstallReferrer(now);

      // Then
      const expected = createPendingRedemption({ source: 'install_referrer', savedAt: now });
      expect(result).toEqual(expected);
      expect(pendingRedemptionRepository.find()).toEqual(expected);
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
  });
});

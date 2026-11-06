import type { SyncStorage } from '@src/core/ports/sync-storage';
import { createMemorySyncStorage } from '@src/shared/__tests__';
import { toInstant } from '@src/shared/date/instant';

import { createWhatsNewRepository, whatsNewSeenKey } from './whats-new.repository';

const identity = { userId: 'user-1', campaignId: 'feature-discovery-2026-08' };
const claimedAt = toInstant('2026-08-02T00:00:00.000Z');

function createFailingStorage(): SyncStorage {
  const fail = () => {
    throw new Error('storage unavailable');
  };

  return { get: fail, set: fail, remove: fail };
}

describe('whats-new 본 기록', () => {
  it('계정과 캠페인별 키를 한 번만 claim한다', () => {
    // Given
    const repository = createWhatsNewRepository(createMemorySyncStorage());

    // When
    const first = repository.claimSeen(identity, claimedAt);
    const second = repository.claimSeen(identity, claimedAt);

    // Then
    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('저장 키는 1.14 이하와 같다', () => {
    // Given
    const storage = createMemorySyncStorage();
    storage.set('aido_feature_discovery_seen_v1:user-1:feature-discovery-2026-08', claimedAt);
    storage.set('aido_feature_discovery_reentry_v1:user-1:feature-discovery-2026-08', claimedAt);
    const repository = createWhatsNewRepository(storage);

    // Then
    expect(whatsNewSeenKey(identity)).toBe(
      'aido_feature_discovery_seen_v1:user-1:feature-discovery-2026-08',
    );
    expect(repository.isSeen(identity)).toBe(true);
    expect(repository.getReentryOpenedAt(identity)).toBe(claimedAt);
  });

  it('다른 계정의 본 기록을 공유하지 않는다', () => {
    // Given
    const repository = createWhatsNewRepository(createMemorySyncStorage());
    repository.claimSeen(identity, claimedAt);

    // Then
    expect(repository.isSeen({ ...identity, userId: 'user-2' })).toBe(false);
  });

  it('저장소를 읽지 못하면 본 것으로 두어 자동으로 열지 않는다', () => {
    // Given
    const repository = createWhatsNewRepository(createFailingStorage());

    // Then
    expect(repository.isSeen(identity)).toBe(true);
  });

  it('기록에 실패하면 claim하지 않는다', () => {
    // Given
    const storage = createMemorySyncStorage();
    jest.spyOn(storage, 'set').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    const repository = createWhatsNewRepository(storage);

    // When
    const result = repository.claimSeen(identity, claimedAt);

    // Then
    expect(result).toBe(false);
  });
});

describe('whats-new 재진입 시각', () => {
  it('손상된 시각은 없는 것으로 읽는다', () => {
    // Given
    const storage = createMemorySyncStorage();
    storage.set('aido_feature_discovery_reentry_v1:user-1:feature-discovery-2026-08', 'not-a-date');

    // When
    const result = createWhatsNewRepository(storage).getReentryOpenedAt(identity);

    // Then
    expect(result).toBeNull();
  });

  it('저장소를 읽지 못하면 없는 것으로 읽는다', () => {
    // When
    const result = createWhatsNewRepository(createFailingStorage()).getReentryOpenedAt(identity);

    // Then
    expect(result).toBeNull();
  });

  it('닫으면 다시 claim해도 돌아오지 않는다', () => {
    // Given
    const repository = createWhatsNewRepository(createMemorySyncStorage());
    repository.claimSeen(identity, claimedAt);

    // When
    repository.dismissReentry(identity);
    const reclaimed = repository.claimSeen(identity, claimedAt);

    // Then
    expect(reclaimed).toBe(false);
    expect(repository.getReentryOpenedAt(identity)).toBeNull();
  });

  it('한 계정·캠페인에서 닫아도 다른 계정과 새 캠페인의 기록은 남는다', () => {
    // Given
    const repository = createWhatsNewRepository(createMemorySyncStorage());
    const otherUser = { ...identity, userId: 'user-2' };
    const nextCampaign = { ...identity, campaignId: 'feature-discovery-2026-11' };
    repository.claimSeen(identity, claimedAt);
    repository.claimSeen(otherUser, claimedAt);
    repository.claimSeen(nextCampaign, claimedAt);

    // When
    repository.dismissReentry(identity);

    // Then
    expect(repository.getReentryOpenedAt(otherUser)).toBe(claimedAt);
    expect(repository.getReentryOpenedAt(nextCampaign)).toBe(claimedAt);
  });

  it('저장소에서 지우지 못해도 멈추지 않는다', () => {
    // Given
    const repository = createWhatsNewRepository(createFailingStorage());

    // Then
    expect(() => repository.dismissReentry(identity)).not.toThrow();
  });
});

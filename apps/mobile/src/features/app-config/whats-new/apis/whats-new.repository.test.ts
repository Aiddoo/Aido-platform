import type { EnumerableSyncStorage, SyncStorage } from '@src/core/ports/sync-storage';
import { createMemorySyncStorage } from '@src/shared/__tests__';
import { toInstant } from '@src/shared/date/instant';

import { createWhatsNewRepository, whatsNewSeenKey } from './whats-new.repository';

const identity = { userId: 'user-1', campaignId: 'feature-discovery-2026-08' };
const claimedAt = toInstant('2026-08-02T00:00:00.000Z');

function createFailingStorage(): SyncStorage & Pick<EnumerableSyncStorage, 'keys'> {
  const fail = () => {
    throw new Error('storage unavailable');
  };

  return { get: fail, set: fail, remove: fail, keys: fail };
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

describe('whats-new 키 정리', () => {
  const SEEN = 'aido_feature_discovery_seen_v1';
  const REENTRY = 'aido_feature_discovery_reentry_v1';
  const CURRENT = 'feature-discovery-2026-12';
  const RETIRED = 'feature-discovery-2026-08';

  it('번들에 없는 캠페인 키와 14일 지난 재진입 키만 지운다', () => {
    // Given
    const storage = createMemorySyncStorage();
    storage.set(`${SEEN}:user-1:${CURRENT}`, claimedAt);
    storage.set(`${REENTRY}:user-1:${CURRENT}`, claimedAt);
    storage.set(`${REENTRY}:user-2:${CURRENT}`, '2026-08-20T00:00:00.000Z');
    storage.set(`${SEEN}:user-1:${RETIRED}`, claimedAt);
    storage.set(`${REENTRY}:user-1:${RETIRED}`, claimedAt);
    storage.set('aido_activation_v1:user-1:feature-discovery-2026-08', '{}');

    // When
    createWhatsNewRepository(storage).removeRetiredKeys({
      campaignIds: [CURRENT],
      now: toInstant('2026-08-21T00:00:00.000Z'),
    });

    // Then
    expect(storage.keys().sort()).toEqual(
      [
        'aido_activation_v1:user-1:feature-discovery-2026-08',
        `${REENTRY}:user-2:${CURRENT}`,
        `${SEEN}:user-1:${CURRENT}`,
      ].sort(),
    );
  });

  it('탈퇴한 계정의 키만 지운다', () => {
    // Given
    const storage = createMemorySyncStorage();
    const repository = createWhatsNewRepository(storage);
    repository.claimSeen({ userId: 'user-1', campaignId: CURRENT }, claimedAt);
    repository.claimSeen({ userId: 'user-10', campaignId: CURRENT }, claimedAt);

    // When
    repository.removeAccount('user-1');

    // Then
    expect(repository.isSeen({ userId: 'user-1', campaignId: CURRENT })).toBe(false);
    expect(repository.isSeen({ userId: 'user-10', campaignId: CURRENT })).toBe(true);
  });
});

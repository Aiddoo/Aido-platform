import { toInstant } from '@src/shared/date/instant';
import { createMemoryObservableSyncStorage, createMemorySyncStorage } from '@src/testing/core';
import { noop } from 'es-toolkit';

import { createWhatsNewRepository } from './whats-new.repository';

const identity = { userId: 'user-1', campaignId: 'feature-discovery-2026-08' };
const claimedAt = toInstant('2026-08-02T00:00:00.000Z');

function createFailingStorage() {
  const storage = createMemorySyncStorage();
  const fail = () => {
    throw new Error('storage unavailable');
  };
  storage.get.mockImplementation(fail);
  storage.set.mockImplementation(fail);
  storage.remove.mockImplementation(fail);

  return { ...storage, subscribe: () => noop };
}

describe('whats-new 본 기록', () => {
  it('계정과 캠페인별 키를 한 번만 claim한다', () => {
    // Given
    const repository = createWhatsNewRepository(createMemoryObservableSyncStorage());

    // When
    const first = repository.claimSeen(identity, claimedAt);
    const second = repository.claimSeen(identity, claimedAt);
    const otherAccount = repository.claimSeen({ ...identity, userId: 'user-2' }, claimedAt);

    // Then
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(otherAccount).toBe(true);
  });

  it('저장 키는 1.14 이하와 같아 이미 본 사람은 claim되지 않는다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set('aido_feature_discovery_seen_v1:user-1:feature-discovery-2026-08', claimedAt);
    const repository = createWhatsNewRepository(storage);

    // When
    const result = repository.claimSeen(identity, claimedAt);

    // Then
    expect(result).toBe(false);
    expect(repository.hasSeen(identity)).toBe(true);
  });

  it('저장소를 쓰지 못하면 claim하지 않아 자동으로 열지 않는다', () => {
    // Given
    const repository = createWhatsNewRepository(createFailingStorage());

    // When
    const result = repository.claimSeen(identity, claimedAt);

    // Then
    expect(result).toBe(false);
  });
});

describe('whats-new 재진입 시각', () => {
  it('손상된 시각은 없는 것으로 읽고 이전 버전이 쓴 시각은 그대로 읽는다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const repository = createWhatsNewRepository(storage);
    const otherUser = { ...identity, userId: 'user-2' };
    storage.set('aido_feature_discovery_reentry_v1:user-1:feature-discovery-2026-08', 'not-a-date');
    storage.set(
      'aido_feature_discovery_reentry_v1:user-3:feature-discovery-2026-08',
      '2026-08-02T00:00:00.000Z',
    );

    // When
    const corrupted = repository.findReentryOpenedAt(identity);
    const missing = repository.findReentryOpenedAt(otherUser);
    const saved = repository.findReentryOpenedAt({ ...identity, userId: 'user-3' });

    // Then
    expect(corrupted).toBeNull();
    expect(missing).toBeNull();
    expect(saved).toBe(claimedAt);
  });

  it('닫으면 재진입 키만 지워 다시 claim해도 돌아오지 않는다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const repository = createWhatsNewRepository(storage);
    repository.claimSeen(identity, claimedAt);

    // When
    repository.dismissReentry(identity);
    const reclaimed = repository.claimSeen(identity, claimedAt);

    // Then
    expect(reclaimed).toBe(false);
    expect(
      storage.get('aido_feature_discovery_reentry_v1:user-1:feature-discovery-2026-08'),
    ).toBeUndefined();
  });

  it('한 계정·캠페인에서 닫아도 다른 계정과 새 캠페인의 기록은 남는다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const repository = createWhatsNewRepository(storage);
    const otherUser = { ...identity, userId: 'user-2' };
    const nextCampaign = { ...identity, campaignId: 'feature-discovery-2026-11' };
    repository.claimSeen(identity, claimedAt);
    repository.claimSeen(otherUser, claimedAt);
    repository.claimSeen(nextCampaign, claimedAt);

    // When
    repository.dismissReentry(identity);

    // Then
    expect(repository.findReentryOpenedAt(otherUser)).toBe(claimedAt);
    expect(repository.findReentryOpenedAt(nextCampaign)).toBe(claimedAt);
  });

  it('저장소에서 지우지 못해도 멈추지 않는다', () => {
    // Given
    const repository = createWhatsNewRepository(createFailingStorage());

    // When
    const dismiss = () => repository.dismissReentry(identity);

    // Then
    expect(dismiss).not.toThrow();
  });
});

describe('whats-new 키 정리', () => {
  const SEEN = 'aido_feature_discovery_seen_v1';
  const REENTRY = 'aido_feature_discovery_reentry_v1';
  const CURRENT = 'feature-discovery-2026-12';
  const RETIRED = 'feature-discovery-2026-08';

  it('번들에 없는 캠페인 키와 14일 지난 재진입 키만 지운다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
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
    const storage = createMemoryObservableSyncStorage();
    const repository = createWhatsNewRepository(storage);
    repository.claimSeen({ userId: 'user-1', campaignId: CURRENT }, claimedAt);
    repository.claimSeen({ userId: 'user-10', campaignId: CURRENT }, claimedAt);

    // When
    repository.clear('user-1');

    // Then
    expect(storage.get(`${SEEN}:user-1:${CURRENT}`)).toBeUndefined();
    expect(storage.get(`${SEEN}:user-10:${CURRENT}`)).toBe(claimedAt);
  });
});

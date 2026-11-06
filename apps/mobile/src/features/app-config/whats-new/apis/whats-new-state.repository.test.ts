import { createSyncStorageStub } from '@src/shared/__tests__/create-sync-storage-stub';

import {
  claimWhatsNewSeen,
  createWhatsNewStateRepository,
  dismissWhatsNewReentry,
  whatsNewSeenKey,
  isWhatsNewReentryVisible,
  isWhatsNewSeen,
} from './whats-new-state.repository';

const input = {
  userId: 'user-1',
  campaignId: 'feature-discovery-2026-08',
};

describe('whats-new 본 상태', () => {
  it('계정과 캠페인별 키를 동기적으로 한 번만 claim한다', () => {
    // Given
    const storage = createSyncStorageStub();
    const values = new Map<string, string>();
    storage.get.mockImplementation((key) => values.get(key));
    storage.set.mockImplementation((key, value) => values.set(key, value));
    const at = new Date('2026-08-02T00:00:00.000Z');
    const repository = createWhatsNewStateRepository(storage);

    // When
    const first = repository.claimSeen({ ...input, at });
    const second = repository.claimSeen({ ...input, at });

    // Then
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(whatsNewSeenKey(input)).toBe(
      'aido_feature_discovery_seen_v1:user-1:feature-discovery-2026-08',
    );
  });

  it('다른 계정의 본 상태를 공유하지 않는다', () => {
    // Given
    const storage = createSyncStorageStub();
    storage.get.mockImplementation((key) =>
      key.includes('user-1') ? '2026-08-02T00:00:00.000Z' : undefined,
    );

    // When & Then
    expect(isWhatsNewSeen(storage, input)).toBe(true);
    expect(isWhatsNewSeen(storage, { ...input, userId: 'user-2' })).toBe(false);
  });

  it('저장소를 읽지 못하면 자동 노출을 fail closed 한다', () => {
    // Given
    const storage = createSyncStorageStub();
    storage.get.mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    // When
    const result = isWhatsNewSeen(storage, input);

    // Then
    expect(result).toBe(true);
  });

  it('본 상태 기록에 실패하면 claim하지 않는다', () => {
    // Given
    const storage = createSyncStorageStub();
    storage.get.mockReturnValue(undefined);
    storage.set.mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    // When
    const result = claimWhatsNewSeen(storage, {
      ...input,
      at: new Date('2026-08-02T00:00:00.000Z'),
    });

    // Then
    expect(result).toBe(false);
  });
});

describe('whats-new 14일 재진입', () => {
  it('최초 claim 후 14일 미만이면 재진입 카드를 표시한다', () => {
    // Given
    const storage = createSyncStorageStub();
    const values = new Map<string, string>();
    storage.get.mockImplementation((key) => values.get(key));
    storage.set.mockImplementation((key, value) => values.set(key, value));
    claimWhatsNewSeen(storage, {
      ...input,
      at: new Date('2026-08-02T00:00:00.000Z'),
    });

    // When
    const result = isWhatsNewReentryVisible(storage, {
      ...input,
      now: new Date('2026-08-15T23:59:59.999Z'),
    });

    // Then
    expect(result).toBe(true);
  });

  it('14일 경계부터는 재진입 카드를 표시하지 않는다', () => {
    // Given
    const storage = createSyncStorageStub();
    const values = new Map<string, string>();
    storage.get.mockImplementation((key) => values.get(key));
    storage.set.mockImplementation((key, value) => values.set(key, value));
    claimWhatsNewSeen(storage, {
      ...input,
      at: new Date('2026-08-02T00:00:00.000Z'),
    });

    // When
    const result = isWhatsNewReentryVisible(storage, {
      ...input,
      now: new Date('2026-08-16T00:00:00.000Z'),
    });

    // Then
    expect(result).toBe(false);
  });

  it('손상된 시각은 fail closed로 숨긴다', () => {
    // Given
    const storage = createSyncStorageStub();
    storage.get.mockReturnValue('not-a-date');

    // When
    const result = isWhatsNewReentryVisible(storage, {
      ...input,
      now: new Date('2026-08-03T00:00:00.000Z'),
    });

    // Then
    expect(result).toBe(false);
  });

  it('저장소를 읽지 못하면 재진입 카드를 숨긴다', () => {
    // Given
    const storage = createSyncStorageStub();
    storage.get.mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    // When
    const result = isWhatsNewReentryVisible(storage, {
      ...input,
      now: new Date('2026-08-03T00:00:00.000Z'),
    });

    // Then
    expect(result).toBe(false);
  });
});

describe('whats-new 재진입 카드 닫기', () => {
  const claimedAt = new Date('2026-08-02T00:00:00.000Z');
  const now = new Date('2026-08-03T00:00:00.000Z');

  const createStatefulStorage = () => {
    const storage = createSyncStorageStub();
    const values = new Map<string, string>();
    storage.get.mockImplementation((key) => values.get(key));
    storage.set.mockImplementation((key, value) => values.set(key, value));
    storage.remove.mockImplementation((key) => values.delete(key));
    return storage;
  };

  it('닫은 캠페인의 재진입 카드는 다시 claim해도 돌아오지 않는다', () => {
    // Given
    const storage = createStatefulStorage();
    claimWhatsNewSeen(storage, { ...input, at: claimedAt });

    // When
    dismissWhatsNewReentry(storage, input);
    const reclaimed = claimWhatsNewSeen(storage, { ...input, at: now });

    // Then
    expect(reclaimed).toBe(false);
    expect(isWhatsNewReentryVisible(storage, { ...input, now })).toBe(false);
  });

  it('한 계정·캠페인에서 닫아도 다른 계정과 새 캠페인의 카드는 남는다', () => {
    // Given
    const storage = createStatefulStorage();
    const otherUser = { ...input, userId: 'user-2' };
    const nextCampaign = { ...input, campaignId: 'feature-discovery-2026-11' };
    claimWhatsNewSeen(storage, { ...input, at: claimedAt });
    claimWhatsNewSeen(storage, { ...otherUser, at: claimedAt });
    claimWhatsNewSeen(storage, { ...nextCampaign, at: claimedAt });

    // When
    dismissWhatsNewReentry(storage, input);

    // Then
    expect(isWhatsNewReentryVisible(storage, { ...otherUser, now })).toBe(true);
    expect(isWhatsNewReentryVisible(storage, { ...nextCampaign, now })).toBe(true);
  });

  it('이전 버전이 저장한 재진입 시각을 그대로 읽는다', () => {
    // Given
    const storage = createSyncStorageStub();
    storage.get.mockReturnValue(claimedAt.toISOString());

    // When
    const result = isWhatsNewReentryVisible(storage, { ...input, now });

    // Then
    expect(result).toBe(true);
  });

  it('저장소에서 지우지 못해도 앱을 멈추지 않는다', () => {
    // Given
    const storage = createSyncStorageStub();
    storage.remove.mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    // When & Then
    expect(() => dismissWhatsNewReentry(storage, input)).not.toThrow();
  });
});

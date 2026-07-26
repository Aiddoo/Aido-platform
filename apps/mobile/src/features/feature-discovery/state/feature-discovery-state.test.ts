import { createMockSyncStorage } from '@src/shared/__tests__/create-mock-sync-storage';
import {
  claimFeatureDiscoverySeen,
  featureDiscoverySeenKey,
  isFeatureDiscoveryReentryVisible,
  isFeatureDiscoverySeen,
} from './feature-discovery-state';

const input = {
  userId: 'user-1',
  campaignId: 'feature-discovery-2026-08',
};

describe('feature discovery 본 상태', () => {
  it('계정과 캠페인별 키를 동기적으로 한 번만 claim한다', () => {
    // Given
    const storage = createMockSyncStorage();
    const values = new Map<string, string>();
    storage.getString.mockImplementation((key) => values.get(key));
    storage.set.mockImplementation((key, value) => values.set(key, value));
    const at = new Date('2026-08-02T00:00:00.000Z');

    // When
    const first = claimFeatureDiscoverySeen(storage, { ...input, at });
    const second = claimFeatureDiscoverySeen(storage, { ...input, at });

    // Then
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(featureDiscoverySeenKey(input)).toBe(
      'aido_feature_discovery_seen_v1:user-1:feature-discovery-2026-08',
    );
  });

  it('다른 계정의 본 상태를 공유하지 않는다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockImplementation((key) =>
      key.includes('user-1') ? '2026-08-02T00:00:00.000Z' : undefined,
    );

    // When & Then
    expect(isFeatureDiscoverySeen(storage, input)).toBe(true);
    expect(isFeatureDiscoverySeen(storage, { ...input, userId: 'user-2' })).toBe(false);
  });

  it('저장소를 읽지 못하면 자동 노출을 fail closed 한다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    // When
    const result = isFeatureDiscoverySeen(storage, input);

    // Then
    expect(result).toBe(true);
  });

  it('본 상태 기록에 실패하면 claim하지 않는다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue(undefined);
    storage.set.mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    // When
    const result = claimFeatureDiscoverySeen(storage, {
      ...input,
      at: new Date('2026-08-02T00:00:00.000Z'),
    });

    // Then
    expect(result).toBe(false);
  });
});

describe('feature discovery 14일 재진입', () => {
  it('최초 claim 후 14일 미만이면 재진입 카드를 표시한다', () => {
    // Given
    const storage = createMockSyncStorage();
    const values = new Map<string, string>();
    storage.getString.mockImplementation((key) => values.get(key));
    storage.set.mockImplementation((key, value) => values.set(key, value));
    claimFeatureDiscoverySeen(storage, {
      ...input,
      at: new Date('2026-08-02T00:00:00.000Z'),
    });

    // When
    const result = isFeatureDiscoveryReentryVisible(storage, {
      ...input,
      now: new Date('2026-08-15T23:59:59.999Z'),
    });

    // Then
    expect(result).toBe(true);
  });

  it('14일 경계부터는 재진입 카드를 표시하지 않는다', () => {
    // Given
    const storage = createMockSyncStorage();
    const values = new Map<string, string>();
    storage.getString.mockImplementation((key) => values.get(key));
    storage.set.mockImplementation((key, value) => values.set(key, value));
    claimFeatureDiscoverySeen(storage, {
      ...input,
      at: new Date('2026-08-02T00:00:00.000Z'),
    });

    // When
    const result = isFeatureDiscoveryReentryVisible(storage, {
      ...input,
      now: new Date('2026-08-16T00:00:00.000Z'),
    });

    // Then
    expect(result).toBe(false);
  });

  it('손상된 시각은 fail closed로 숨긴다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockReturnValue('not-a-date');

    // When
    const result = isFeatureDiscoveryReentryVisible(storage, {
      ...input,
      now: new Date('2026-08-03T00:00:00.000Z'),
    });

    // Then
    expect(result).toBe(false);
  });

  it('저장소를 읽지 못하면 재진입 카드를 숨긴다', () => {
    // Given
    const storage = createMockSyncStorage();
    storage.getString.mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    // When
    const result = isFeatureDiscoveryReentryVisible(storage, {
      ...input,
      now: new Date('2026-08-03T00:00:00.000Z'),
    });

    // Then
    expect(result).toBe(false);
  });
});

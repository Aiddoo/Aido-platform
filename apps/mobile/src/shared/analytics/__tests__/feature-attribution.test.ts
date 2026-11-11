import { createAnalyticsStub, createLoggerStub, createMemorySyncStorage } from '@src/testing/core';

import {
  createFeatureAttributionStore,
  FEATURE_ATTRIBUTION_TTL_MS,
  trackAttributedFeatureSuccess,
} from '../feature-attribution';

describe('FeatureAttributionStore', () => {
  const now = new Date('2026-08-10T00:00:00.000Z').getTime();

  it('계정·기능별 CTA를 7일 동안 저장하고 일치하는 성공에서 한 번만 소비한다', () => {
    // Given
    const storage = createMemorySyncStorage();
    const values = new Map<string, string>();
    storage.get.mockImplementation((key) => values.get(key));
    storage.set.mockImplementation((key, value) => values.set(key, value));
    storage.remove.mockImplementation((key) => values.delete(key));
    const attribution = createFeatureAttributionStore(storage, () => now);

    // When
    attribution.record({
      accountId: 'account-a',
      campaignId: 'feature-discovery-2026-08',
      feature: 'memo_ai',
    });
    const first = attribution.consume({ accountId: 'account-a', feature: 'memo_ai' });
    const second = attribution.consume({ accountId: 'account-a', feature: 'memo_ai' });

    // Then
    expect(first).toEqual({
      campaignId: 'feature-discovery-2026-08',
      feature: 'memo_ai',
    });
    expect(second).toBeNull();
    expect(storage.set).toHaveBeenCalledWith(
      'aido_feature_attribution_v1:account-a:memo_ai',
      JSON.stringify({
        campaignId: 'feature-discovery-2026-08',
        feature: 'memo_ai',
        expiresAt: now + FEATURE_ATTRIBUTION_TTL_MS,
      }),
    );
  });

  it('귀속 저장소 읽기 실패가 실제 기능 성공 후 UX를 중단시키지 않는다', () => {
    // Given
    const analytics = createAnalyticsStub();
    const attribution = {
      record: jest.fn(),
      consume: jest.fn(() => {
        throw new Error('storage unavailable');
      }),
    };

    // When
    const emit = () =>
      trackAttributedFeatureSuccess(
        { analytics, attribution, logger: createLoggerStub() },
        {
          accountId: 'account-1',
          feature: 'todo_creation',
        },
      );

    // Then
    expect(emit).not.toThrow();
    emit();
    expect(analytics.trackEvent).not.toHaveBeenCalled();
  });

  it('분석 전송 실패도 실제 기능 성공 콜백 밖으로 전파하지 않는다', () => {
    // Given
    const analytics = createAnalyticsStub();
    analytics.trackEvent.mockImplementation(() => {
      throw new Error('analytics unavailable');
    });
    const attribution = {
      record: jest.fn(),
      consume: jest.fn(() => ({
        campaignId: 'feature-discovery-2026-08',
        feature: 'todo_reorder' as const,
      })),
    };

    // When
    const emit = () =>
      trackAttributedFeatureSuccess(
        { analytics, attribution, logger: createLoggerStub() },
        {
          accountId: 'account-1',
          feature: 'todo_reorder',
        },
      );

    // Then
    expect(emit).not.toThrow();
  });

  it('다른 계정이나 다른 기능의 실제 행동은 attribution을 소비하지 않는다', () => {
    // Given
    const storage = createMemorySyncStorage();
    const values = new Map<string, string>();
    storage.get.mockImplementation((key) => values.get(key));
    storage.set.mockImplementation((key, value) => values.set(key, value));
    storage.remove.mockImplementation((key) => values.delete(key));
    const attribution = createFeatureAttributionStore(storage, () => now);
    attribution.record({
      accountId: 'account-a',
      campaignId: 'feature-discovery-2026-08',
      feature: 'todo_reorder',
    });

    // When
    const otherAccount = attribution.consume({ accountId: 'account-b', feature: 'todo_reorder' });
    const otherFeature = attribution.consume({
      accountId: 'account-a',
      feature: 'category_reorder',
    });
    const matched = attribution.consume({ accountId: 'account-a', feature: 'todo_reorder' });

    // Then
    expect(otherAccount).toBeNull();
    expect(otherFeature).toBeNull();
    expect(matched).not.toBeNull();
  });

  it('7일이 지난 attribution은 성공으로 집계하지 않고 제거한다', () => {
    // Given
    const storage = createMemorySyncStorage();
    const values = new Map<string, string>();
    storage.get.mockImplementation((key) => values.get(key));
    storage.set.mockImplementation((key, value) => values.set(key, value));
    storage.remove.mockImplementation((key) => values.delete(key));
    let currentTime = now;
    const attribution = createFeatureAttributionStore(storage, () => currentTime);
    attribution.record({
      accountId: 'account-a',
      campaignId: 'feature-discovery-2026-08',
      feature: 'friend_search',
    });

    // When
    currentTime = now + FEATURE_ATTRIBUTION_TTL_MS + 1;
    const result = attribution.consume({ accountId: 'account-a', feature: 'friend_search' });

    // Then
    expect(result).toBeNull();
    expect(storage.remove).toHaveBeenCalledWith(
      'aido_feature_attribution_v1:account-a:friend_search',
    );
  });

  it('손상되거나 알 수 없는 기능의 저장값은 실패를 던지지 않고 삭제한다', () => {
    // Given
    const storage = createMemorySyncStorage();
    storage.get.mockReturnValueOnce('{broken').mockReturnValueOnce(
      JSON.stringify({
        campaignId: 'feature-discovery-2026-08',
        feature: 'raw-user-query',
        expiresAt: now + FEATURE_ATTRIBUTION_TTL_MS,
      }),
    );
    const attribution = createFeatureAttributionStore(storage, () => now);

    // When
    const broken = attribution.consume({ accountId: 'account-a', feature: 'memo_ai' });
    const unknownFeature = attribution.consume({ accountId: 'account-a', feature: 'memo_ai' });

    // Then
    expect(broken).toBeNull();
    expect(unknownFeature).toBeNull();
    expect(storage.remove).toHaveBeenCalledTimes(2);
  });

  it('실제 성공에서는 계정 ID 없이 캠페인과 기능만 한 번 전송한다', () => {
    // Given
    const storage = createMemorySyncStorage();
    const values = new Map<string, string>();
    storage.get.mockImplementation((key) => values.get(key));
    storage.set.mockImplementation((key, value) => values.set(key, value));
    storage.remove.mockImplementation((key) => values.delete(key));
    const attribution = createFeatureAttributionStore(storage, () => now);
    const analytics = createAnalyticsStub();
    attribution.record({
      accountId: 'raw-account-id',
      campaignId: 'feature-discovery-2026-08',
      feature: 'category_reorder',
    });

    // When
    trackAttributedFeatureSuccess(
      { analytics, attribution, logger: createLoggerStub() },
      {
        accountId: 'raw-account-id',
        feature: 'category_reorder',
      },
    );
    trackAttributedFeatureSuccess(
      { analytics, attribution, logger: createLoggerStub() },
      {
        accountId: 'raw-account-id',
        feature: 'category_reorder',
      },
    );

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith('feature_action_success', {
      campaign_id: 'feature-discovery-2026-08',
      feature: 'category_reorder',
    });
    expect(JSON.stringify(analytics.trackEvent.mock.calls)).not.toContain('raw-account-id');
  });
});

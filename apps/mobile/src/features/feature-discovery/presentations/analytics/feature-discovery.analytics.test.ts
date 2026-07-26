import { createMockAnalytics } from '@src/shared/__tests__/create-mock-analytics';
import type { FeatureAttributionStore } from '@src/shared/analytics/feature-attribution';
import {
  recordFeatureDiscoveryCardCta,
  recordFeatureDiscoveryDismissed,
  recordFeatureDiscoveryImpression,
} from './feature-discovery.analytics';

const createAttributionStore = (): jest.Mocked<FeatureAttributionStore> => ({
  record: jest.fn(),
  consume: jest.fn(),
});

describe('feature discovery analytics', () => {
  it('허브 노출과 닫기에 캠페인과 진입점만 기록한다', () => {
    // Given
    const analytics = createMockAnalytics();

    // When
    recordFeatureDiscoveryImpression(analytics, {
      campaignId: 'feature-discovery-2026-08',
      source: 'auto',
    });
    recordFeatureDiscoveryDismissed(analytics, {
      campaignId: 'feature-discovery-2026-08',
      source: 'auto',
    });

    // Then
    expect(analytics.trackEvent).toHaveBeenNthCalledWith(1, 'feature_hub_impression', {
      campaign_id: 'feature-discovery-2026-08',
      source: 'auto',
    });
    expect(analytics.trackEvent).toHaveBeenNthCalledWith(2, 'feature_hub_dismissed', {
      campaign_id: 'feature-discovery-2026-08',
      source: 'auto',
    });
  });

  it('카드 CTA는 저카디널리티 기능만 분석하고 계정은 로컬 귀속에만 사용한다', () => {
    // Given
    const analytics = createMockAnalytics();
    const attribution = createAttributionStore();

    // When
    recordFeatureDiscoveryCardCta(analytics, attribution, {
      accountId: 'private-user-id',
      campaignId: 'feature-discovery-2026-08',
      cardId: 'drag_reorder',
      source: 'mypage',
    });

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledWith('feature_card_cta', {
      campaign_id: 'feature-discovery-2026-08',
      feature: 'category_reorder',
      source: 'mypage',
    });
    expect(analytics.trackEvent).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ accountId: expect.anything() }),
    );
    expect(attribution.record).toHaveBeenCalledWith({
      accountId: 'private-user-id',
      campaignId: 'feature-discovery-2026-08',
      feature: 'category_reorder',
    });
  });

  it('계정 조회가 실패해도 CTA 분석과 이동을 막지 않고 귀속만 생략한다', () => {
    // Given
    const analytics = createMockAnalytics();
    const attribution = createAttributionStore();

    // When
    recordFeatureDiscoveryCardCta(analytics, attribution, {
      accountId: undefined,
      campaignId: 'feature-discovery-2026-08',
      cardId: 'memo_ai',
      source: 'mypage',
    });

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledWith('feature_card_cta', {
      campaign_id: 'feature-discovery-2026-08',
      feature: 'memo_ai',
      source: 'mypage',
    });
    expect(attribution.record).not.toHaveBeenCalled();
  });
});

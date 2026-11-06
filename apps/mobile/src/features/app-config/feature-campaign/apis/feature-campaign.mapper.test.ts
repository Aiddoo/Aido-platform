import type { FeatureDiscoveryResponse } from '@aido/api';

import { toFeatureCampaignConfig } from './feature-campaign.mapper';

describe('toFeatureCampaignConfig', () => {
  it('활성 응답의 출시 시각을 Instant로 옮긴다', () => {
    // Given
    const response: FeatureDiscoveryResponse = {
      enabled: true,
      campaignId: 'feature-discovery-2026-08',
      minAppVersion: '1.8.0',
      launchedAt: '2026-08-01T00:00:00.000Z',
      autoOpen: true,
    };

    // When
    const result = toFeatureCampaignConfig(response);

    // Then
    expect(result.enabled).toBe(true);
    if (result.enabled) {
      expect(result.launchedAt).toBe('2026-08-01T00:00:00.000Z');
    }
  });

  it('비활성 응답은 비활성 도메인 값으로 유지한다', () => {
    // When
    const result = toFeatureCampaignConfig({ enabled: false });

    // Then
    expect(result).toEqual({ enabled: false });
  });
});

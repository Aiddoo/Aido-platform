import { type FeatureDiscoveryResponse, featureDiscoveryResponseSchema } from '@aido/api';

import { toFeatureCampaignConfig } from './feature-campaign.mapper';

describe('toFeatureCampaignConfig', () => {
  it('계약이 그대로 보내는 출시 시각은 1.15.0 이하 앱만 읽어 옮기지 않는다', () => {
    // Given
    const response: FeatureDiscoveryResponse = featureDiscoveryResponseSchema.parse({
      enabled: true,
      campaignId: 'feature-discovery-2026-12',
      minAppVersion: '1.15.0',
      launchedAt: '2026-11-10T00:00:00.000Z',
      autoOpen: true,
    });

    // When
    const result = toFeatureCampaignConfig(response);

    // Then
    expect(result).toEqual({
      enabled: true,
      campaignId: 'feature-discovery-2026-12',
      minAppVersion: '1.15.0',
      autoOpen: true,
    });
  });

  it('비활성 응답은 비활성 도메인 값으로 유지한다', () => {
    // When
    const result = toFeatureCampaignConfig({ enabled: false });

    // Then
    expect(result).toEqual({ enabled: false });
  });
});

import type { FeatureDiscoveryResponse } from '@aido/validators';
import { toFeatureDiscoveryConfig } from './feature-discovery.mapper';

describe('toFeatureDiscoveryConfig', () => {
  it('활성 응답의 출시 시각을 Date로 변환한다', () => {
    // Given
    const response: FeatureDiscoveryResponse = {
      enabled: true,
      campaignId: 'feature-discovery-2026-08',
      minAppVersion: '1.8.0',
      launchedAt: '2026-08-01T00:00:00.000Z',
      autoOpen: true,
    };

    // When
    const result = toFeatureDiscoveryConfig(response);

    // Then
    expect(result.enabled).toBe(true);
    if (result.enabled) {
      expect(result.launchedAt).toEqual(new Date('2026-08-01T00:00:00.000Z'));
    }
  });

  it('비활성 응답은 비활성 도메인 값으로 유지한다', () => {
    // When
    const result = toFeatureDiscoveryConfig({ enabled: false });

    // Then
    expect(result).toEqual({ enabled: false });
  });
});

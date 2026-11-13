import { unwrap } from '@src/core/errors/result';
import { createJsonFetcherStub } from '@src/testing/core';

import { WhatsNewCampaignApi } from './whats-new-campaign.api';

describe('WhatsNewCampaignApi', () => {
  it('원문 설정 응답을 검증하고 도메인 설정으로 반환한다', async () => {
    // Given
    const fetcher = createJsonFetcherStub();
    fetcher.get.mockResolvedValue({
      enabled: true,
      campaignId: 'feature-discovery-2026-08',
      minAppVersion: '1.8.0',
      launchedAt: '2026-08-01T00:00:00.000Z',
      autoOpen: true,
    });
    const api = new WhatsNewCampaignApi(fetcher);

    // When
    const result = unwrap(await api.getConfig());

    // Then
    expect(result).toEqual({
      enabled: true,
      campaignId: 'feature-discovery-2026-08',
      minAppVersion: '1.8.0',
      autoOpen: true,
    });
  });
});

import type { JsonFetcher } from '@src/core/ports/json-fetcher';
import { ParseError } from '@src/shared/errors/infra-error';
import { FeatureDiscoveryService } from './feature-discovery.service';

const createMockJsonFetcher = (): jest.Mocked<JsonFetcher> => ({
  get: jest.fn(),
});

describe('FeatureDiscoveryService', () => {
  it('원문 설정 응답을 검증하고 도메인 설정으로 반환한다', async () => {
    // Given
    const fetcher = createMockJsonFetcher();
    fetcher.get.mockResolvedValue({
      enabled: true,
      campaignId: 'feature-discovery-2026-08',
      minAppVersion: '1.8.0',
      launchedAt: '2026-08-01T00:00:00.000Z',
      autoOpen: true,
    });
    const service = new FeatureDiscoveryService(fetcher);

    // When
    const result = await service.getConfig();

    // Then
    expect(result).toEqual({
      enabled: true,
      campaignId: 'feature-discovery-2026-08',
      minAppVersion: '1.8.0',
      launchedAt: new Date('2026-08-01T00:00:00.000Z'),
      autoOpen: true,
    });
  });

  it('응답 스키마가 다르면 ParseError를 던진다', async () => {
    // Given
    const fetcher = createMockJsonFetcher();
    fetcher.get.mockResolvedValue({ data: { enabled: false } });
    const service = new FeatureDiscoveryService(fetcher);

    // When & Then
    await expect(service.getConfig()).rejects.toThrow(ParseError);
  });

  it('네트워크 실패를 삼키지 않고 호출자에게 전파한다', async () => {
    // Given
    const fetcher = createMockJsonFetcher();
    fetcher.get.mockRejectedValue(new Error('offline'));
    const service = new FeatureDiscoveryService(fetcher);

    // When & Then
    await expect(service.getConfig()).rejects.toThrow('offline');
  });
});

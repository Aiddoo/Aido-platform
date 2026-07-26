import type { FeatureDiscoveryStateRepository } from '../repositories/feature-discovery-state.repository';
import { FeatureDiscoveryStateService } from './feature-discovery-state.service';

const identity = {
  userId: 'user-1',
  campaignId: 'feature-discovery-2026-08',
};

const createRepository = (): jest.Mocked<FeatureDiscoveryStateRepository> => ({
  isSeen: jest.fn(),
  claimSeen: jest.fn(),
  isReentryVisible: jest.fn(),
});

describe('FeatureDiscoveryStateService', () => {
  it('claim과 재진입 판정에 동일한 주입 시각을 사용한다', () => {
    // Given
    const repository = createRepository();
    const now = new Date('2026-08-02T03:04:05.000Z');
    repository.claimSeen.mockReturnValue(true);
    repository.isReentryVisible.mockReturnValue(true);
    const service = new FeatureDiscoveryStateService(repository, () => now);

    // When
    const claimed = service.claimSeen(identity);
    const reentryVisible = service.isReentryVisible(identity);

    // Then
    expect(claimed).toBe(true);
    expect(reentryVisible).toBe(true);
    expect(repository.claimSeen).toHaveBeenCalledWith({ ...identity, at: now });
    expect(repository.isReentryVisible).toHaveBeenCalledWith({ ...identity, now });
  });

  it('저장소가 fail closed로 반환한 본 상태를 그대로 전달한다', () => {
    // Given
    const repository = createRepository();
    repository.isSeen.mockReturnValue(true);
    const service = new FeatureDiscoveryStateService(repository);

    // When
    const result = service.isSeen(identity);

    // Then
    expect(result).toBe(true);
  });
});

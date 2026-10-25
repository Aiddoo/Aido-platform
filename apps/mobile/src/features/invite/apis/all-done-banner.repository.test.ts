import { createMemorySyncStorage } from '@src/shared/__tests__';

import { createAllDoneBannerRepository } from './all-done-banner.repository';

describe('createAllDoneBannerRepository', () => {
  it('닫은 날에만 닫힌 것으로 반환한다', () => {
    // Given
    const repository = createAllDoneBannerRepository(createMemorySyncStorage());
    repository.dismiss('user-a', '2026-10-25');

    // When
    const today = repository.isDismissed('user-a', '2026-10-25');
    const tomorrow = repository.isDismissed('user-a', '2026-10-26');

    // Then
    expect(today).toBe(true);
    expect(tomorrow).toBe(false);
  });

  it('다른 계정의 닫기 기록은 반환하지 않는다', () => {
    // Given
    const repository = createAllDoneBannerRepository(createMemorySyncStorage());
    repository.dismiss('user-a', '2026-10-25');

    // When
    const result = repository.isDismissed('user-b', '2026-10-25');

    // Then
    expect(result).toBe(false);
  });
});

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

  it('이 계정의 닫기 기록이 바뀌면 구독한 쪽에 알리고, 해제하면 더 알리지 않는다', () => {
    // Given
    const repository = createAllDoneBannerRepository(createMemorySyncStorage());
    const listener = jest.fn();
    const unsubscribe = repository.subscribe('user-a', listener);

    // When 다른 계정 기록은 알리지 않고, 이 계정을 닫으면 알린다
    repository.dismiss('user-b', '2026-10-25');
    repository.dismiss('user-a', '2026-10-25');
    unsubscribe();
    repository.dismiss('user-a', '2026-10-26');

    // Then
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

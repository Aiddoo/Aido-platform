import { createMemoryObservableSyncStorage } from '@src/shared/__tests__';

import { createAllDoneBannerRepository } from './all-done-banner.repository';

describe('createAllDoneBannerRepository', () => {
  it('닫은 날을 계정마다 한 칸만 남기고 키는 출시된 앱과 같다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    const repository = createAllDoneBannerRepository(storage);

    // When
    repository.dismiss('user-a', '2026-10-25');
    repository.dismiss('user-a', '2026-10-26');

    // Then
    expect(storage.get('aido_invite_all_done_banner_dismissed_v1:user-a')).toBe('2026-10-26');
    expect(repository.findDismissedOn('user-a')).toBe('2026-10-26');
    expect(repository.findDismissedOn('user-b')).toBeNull();
  });
});

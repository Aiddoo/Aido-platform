import { createMemoryObservableSyncStorage } from '@src/testing/core';

import { createActivationProgressRepository } from './activation-progress.repository';

const ACCOUNT_ID = 'account-1';

describe('createActivationProgressRepository', () => {
  it('1.15.0 이하가 캠페인별로 남긴 키만 지우고 지금 키와 다른 설정은 남긴다', () => {
    // Given
    const storage = createMemoryObservableSyncStorage();
    storage.set(`aido_activation_v1:${ACCOUNT_ID}:feature-discovery-2026-12`, '{}');
    storage.set(`aido_activation_v1:${ACCOUNT_ID}:feature-discovery-2026-08`, '{}');
    storage.set(`aido_activation_v2:${ACCOUNT_ID}`, '{}');
    storage.set('aido_feature_discovery_seen_v1:account-1:feature-discovery-2026-12', 'seen');

    // When
    createActivationProgressRepository(storage).removeRetiredKeys();

    // Then
    expect(new Set(storage.keys())).toEqual(
      new Set([
        'aido_activation_v2:account-1',
        'aido_feature_discovery_seen_v1:account-1:feature-discovery-2026-12',
      ]),
    );
  });
});

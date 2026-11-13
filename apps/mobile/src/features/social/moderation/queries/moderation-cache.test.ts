import { createTestQueryClient } from '@src/testing/core';

import { invalidateAfterBlockChange } from './moderation-cache';

describe('invalidateAfterBlockChange', () => {
  it('차단을 바꾸면 refreshOnBlockChange로 밝힌 다른 피처의 조회만 다시 받는다', async () => {
    // Given
    const client = createTestQueryClient();
    const dependentKey = ['other-feature', 'depends-on-block'];
    const independentKey = ['other-feature', 'independent'];
    client.setQueryData(dependentKey, 1);
    client.setQueryData(independentKey, 1);
    client
      .getQueryCache()
      .find({ queryKey: dependentKey })
      ?.setOptions({ meta: { refreshOnBlockChange: true } });

    // When
    await invalidateAfterBlockChange(client);

    // Then
    expect(client.getQueryState(dependentKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(independentKey)?.isInvalidated).toBe(false);
  });
});

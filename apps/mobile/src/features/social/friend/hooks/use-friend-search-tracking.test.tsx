import { createAnalyticsStub, createTestDi } from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';

import { useFriendSearchTracking } from './use-friend-search-tracking';

describe('useFriendSearchTracking', () => {
  it('유효한 실제 화면 검색을 원문 없이 버킷으로 한 번씩 기록한다', async () => {
    // Given
    const analytics = createAnalyticsStub();
    const { rerender } = await renderScreenHook<void, { query: string }>(
      ({ query }) => useFriendSearchTracking(query),
      { initialProps: { query: '가' }, di: createTestDi({ ports: { analytics } }) },
    );

    // When
    await rerender({ query: '가나다' });
    await rerender({ query: '가나다' });
    await rerender({ query: 'Matthew' });

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledTimes(2);
    expect(analytics.trackEvent).toHaveBeenNthCalledWith(1, 'friend_search_submitted', {
      query_length_bucket: '2_3',
    });
    expect(analytics.trackEvent).toHaveBeenNthCalledWith(2, 'friend_search_submitted', {
      query_length_bucket: '4_7',
    });
    expect(JSON.stringify(analytics.trackEvent.mock.calls)).not.toContain('가나다');
    expect(JSON.stringify(analytics.trackEvent.mock.calls)).not.toContain('Matthew');
  });
});

import { FriendPolicy } from '@src/features/friend/models/friend.model';
import { toFriendSearchLengthBucket, useTrack } from '@src/shared/analytics';
import { useEffect, useRef } from 'react';

/** 실제 친구 찾기 화면의 디바운스된 검색만 기록한다. 검색 원문은 메모리에만 머문다. */
export function useFriendSearchTracking(debouncedQuery: string): void {
  const { trackEvent } = useTrack();
  const lastTrackedQuery = useRef<string | null>(null);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!FriendPolicy.isValidSearchQuery(trimmed)) {
      lastTrackedQuery.current = null;
      return;
    }
    if (lastTrackedQuery.current === trimmed) {
      return;
    }

    lastTrackedQuery.current = trimmed;
    trackEvent('friend_search_submitted', {
      query_length_bucket: toFriendSearchLengthBucket(trimmed),
    });
  }, [debouncedQuery, trackEvent]);
}

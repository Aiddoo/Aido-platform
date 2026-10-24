import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { z } from 'zod';

import { createFeedFriendParams } from '../utils/feed-route';
import { feedFriendIdParamSchema } from '../utils/feed-search-params';

const feedFriendSearchSchema = z.object({ friendId: feedFriendIdParamSchema });

type FeedFriendId = z.output<typeof feedFriendSearchSchema>['friendId'];

/** 피드 URL의 `friendId`를 검증해 읽고, 같은 피드 화면에서 친구를 바꾼다. 없으면 내 피드다. */
export function useFeedFriendIdParam(): readonly [FeedFriendId, (friendId: FeedFriendId) => void] {
  const { friendId } = feedFriendSearchSchema.parse(useLocalSearchParams());
  const setFriendId = useCallback(
    (value: FeedFriendId) => router.setParams(createFeedFriendParams(value)),
    [],
  );

  return [friendId, setFriendId] as const;
}

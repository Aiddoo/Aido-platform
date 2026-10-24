import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { z } from 'zod';

import { feedActionParamSchema } from '../utils/feed-search-params';

const feedActionSearchSchema = z.object({ action: feedActionParamSchema });

type FeedAction = z.output<typeof feedActionSearchSchema>['action'];

/** 피드 URL의 `action` param을 검증해 읽고 바꾼다. */
export function useFeedActionParam(): readonly [FeedAction, (action: FeedAction) => void] {
  const { action } = feedActionSearchSchema.parse(useLocalSearchParams());
  const setAction = useCallback((value: FeedAction) => router.setParams({ action: value }), []);

  return [action, setAction] as const;
}

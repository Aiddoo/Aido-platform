import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import type { z } from 'zod';

import { feedSearchParamsSchema } from '../utils/feed-search-params';

type FeedParams = z.output<typeof feedSearchParamsSchema>;

/** 피드 URL의 날짜·친구·요청(action)을 검증해 읽고, 같은 피드 화면 안에서 바꾼다. 친구가 없으면 내 피드다. */
export function useFeedParams() {
  const { date, friendId, action } = feedSearchParamsSchema.parse(useLocalSearchParams());

  const selectDate = useCallback(
    (next: FeedParams['date']) => router.setParams({ date: next }),
    [],
  );

  /** 친구를 바꾸면 날짜만 유지하고 이전 피드의 할 일 선택·댓글·요청 상태는 지운다. */
  const selectFriend = useCallback(
    (next: FeedParams['friendId']) =>
      router.setParams({
        friendId: next,
        todoId: undefined,
        comment: undefined,
        intent: undefined,
        returnTo: undefined,
        sort: undefined,
        action: undefined,
      }),
    [],
  );

  const clearAction = useCallback(() => router.setParams({ action: undefined }), []);

  return { date, friendId, action, selectDate, selectFriend, clearAction };
}

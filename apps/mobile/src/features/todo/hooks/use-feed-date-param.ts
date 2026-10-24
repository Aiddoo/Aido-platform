import { useRouteSearchParams } from '@src/shared/providers/route-search-params-provider';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { z } from 'zod';

import { feedDateParamSchema } from '../utils/feed-date-param';

const feedDateSearchSchema = z.object({ date: feedDateParamSchema });

type FeedDateParam = z.output<typeof feedDateSearchSchema>['date'];

/** 피드 URL의 `date` param을 검증해 읽고 바꾼다. */
export function useFeedDateParam(): readonly [FeedDateParam, (date: FeedDateParam) => void] {
  const { date } = feedDateSearchSchema.parse(useRouteSearchParams());
  const setDate = useCallback((value: FeedDateParam) => router.setParams({ date: value }), []);

  return [date, setDate] as const;
}

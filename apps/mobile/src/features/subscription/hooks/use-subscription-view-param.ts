import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { z } from 'zod';

const SubscriptionViewSchema = z.enum(['status', 'plans']);

type SubscriptionView = z.output<typeof SubscriptionViewSchema>;

/** 구독 화면 보기 상태. 보상 기간만 있는 사용자가 요금제를 고를 때 `plans`로 바뀐다. */
export function useSubscriptionViewParam() {
  const { view } = useLocalSearchParams();
  const setView = useCallback((next: SubscriptionView) => router.setParams({ view: next }), []);

  return [SubscriptionViewSchema.catch('status').parse(view), setView] as const;
}

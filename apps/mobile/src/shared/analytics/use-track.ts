import { useAnalytics } from '@src/bootstrap/providers/di-provider';
import { useCallback } from 'react';
import type { AppEventMap } from './events';

export const useTrack = () => {
  const analytics = useAnalytics();

  const trackEvent = useCallback(
    <E extends keyof AppEventMap>(
      eventName: E,
      ...args: AppEventMap[E] extends undefined ? [] : [params: AppEventMap[E]]
    ) => {
      analytics.trackEvent(eventName as string, args[0] as Record<string, unknown> | undefined);
    },
    [analytics],
  );

  return { trackEvent } as const;
};

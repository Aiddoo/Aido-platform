import { useAnalytics } from '@src/bootstrap/providers/di-provider';
import type { AnalyticsEventParams } from '@src/core/ports/analytics';
import { useCallback } from 'react';
import type { AppEventMap } from './events';

/** `track()`의 hook 버전 — DI에서 Analytics를 받아 타입 이벤트만 전송한다. */
export const useTrack = () => {
  const analytics = useAnalytics();

  const trackEvent = useCallback(
    <E extends keyof AppEventMap & string>(
      eventName: E,
      ...args: AppEventMap[E] extends undefined
        ? []
        : [params: AppEventMap[E] & AnalyticsEventParams]
    ): void => {
      const [params] = args;
      analytics.trackEvent(eventName, params);
    },
    [analytics],
  );

  return { trackEvent };
};

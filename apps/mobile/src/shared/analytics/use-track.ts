import type { AnalyticsEventParams } from '@src/core/ports/analytics';
import { useAnalytics, useFeatureAttribution } from '@src/shared/di/shared-di-context';
import { useCallback } from 'react';

import type { AppEventMap } from './event-map';
import { trackAttributedFeatureSuccess as emitAttributedFeatureSuccess } from './feature-attribution';
import type { FeatureKey } from './feature-key';

/** `track()`의 hook 버전 — DI에서 Analytics를 받아 타입 이벤트만 전송한다. */
export function useTrack() {
  const analytics = useAnalytics();
  const featureAttribution = useFeatureAttribution();

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

  const trackAttributedFeatureSuccess = useCallback(
    ({ accountId, feature }: { accountId: string; feature: FeatureKey }): boolean =>
      emitAttributedFeatureSuccess(analytics, featureAttribution, { accountId, feature }),
    [analytics, featureAttribution],
  );

  return { trackEvent, trackAttributedFeatureSuccess };
}

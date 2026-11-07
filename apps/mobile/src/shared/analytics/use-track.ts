import type { AnalyticsEventParams } from '@src/core/ports/analytics';
import { useAnalytics, useFeatureAttribution } from '@src/shared/di/shared-di-context';
import { useCallback } from 'react';

import type { AppEventMap } from './event-map';
import { trackAttributedFeatureSuccess as emitAttributedFeatureSuccess } from './feature-attribution';
import type { FeatureKey } from './feature-key';

/** feature가 Analytics를 쓰는 유일한 입구. 타입 이벤트 전송과 계정을 떠날 때의 정리만 연다. */
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

  const clearUser = useCallback(() => {
    analytics.clearUser();
  }, [analytics]);

  const resetData = useCallback(() => {
    analytics.resetData();
  }, [analytics]);

  return { trackEvent, trackAttributedFeatureSuccess, clearUser, resetData };
}

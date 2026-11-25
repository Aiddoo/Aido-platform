import { useAnalytics, useFeatureAttribution, useLogger } from '@src/shared/di/shared-di-context';
import { useCallback } from 'react';

import { trackAttributedFeatureSuccess as emitAttributedFeatureSuccess } from './feature-attribution';
import type { FeatureKey } from './feature-key';
import { type AppEventArguments, type AppEventName, track } from './track';

export function useTrack() {
  const analytics = useAnalytics();
  const featureAttribution = useFeatureAttribution();
  const logger = useLogger();

  const trackEvent = useCallback(
    <E extends AppEventName>(eventName: E, ...eventParams: AppEventArguments<E>): void => {
      track(analytics, eventName, ...eventParams);
    },
    [analytics],
  );

  const trackAttributedFeatureSuccess = useCallback(
    ({ accountId, feature }: { accountId: string; feature: FeatureKey }): void =>
      emitAttributedFeatureSuccess(
        { analytics, attribution: featureAttribution, logger },
        { accountId, feature },
      ),
    [analytics, featureAttribution, logger],
  );

  const clearUser = useCallback(() => {
    analytics.clearUser();
  }, [analytics]);

  const resetData = useCallback(() => {
    analytics.resetData();
  }, [analytics]);

  return { trackEvent, trackAttributedFeatureSuccess, clearUser, resetData };
}

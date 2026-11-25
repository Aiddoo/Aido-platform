import { useAnalytics, useFeatureAttribution, useLogger } from '@src/shared/di/shared-di-context';

import { trackAttributedFeatureSuccess as emitAttributedFeatureSuccess } from './feature-attribution';
import type { FeatureKey } from './feature-key';
import { type AppEventArguments, type AppEventName, track } from './track';

export function useTrack() {
  const analytics = useAnalytics();
  const featureAttribution = useFeatureAttribution();
  const logger = useLogger();

  const trackEvent = <E extends AppEventName>(
    eventName: E,
    ...eventParams: AppEventArguments<E>
  ): void => {
    track(analytics, eventName, ...eventParams);
  };

  const trackAttributedFeatureSuccess = ({
    accountId,
    feature,
  }: {
    accountId: string;
    feature: FeatureKey;
  }): void =>
    emitAttributedFeatureSuccess(
      { analytics, attribution: featureAttribution, logger },
      { accountId, feature },
    );

  const clearUser = () => {
    analytics.clearUser();
  };

  const resetData = () => {
    analytics.resetData();
  };

  return { trackEvent, trackAttributedFeatureSuccess, clearUser, resetData };
}

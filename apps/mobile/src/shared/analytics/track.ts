import type { Analytics, AnalyticsEventParams } from '@src/core/ports/analytics';

import type { AppEventMap } from './event-map';

export function track<E extends keyof AppEventMap & string>(
  analytics: Analytics,
  eventName: E,
  ...eventParams: AppEventMap[E] extends undefined
    ? []
    : [params: AppEventMap[E] & AnalyticsEventParams]
): void {
  const [params] = eventParams;
  analytics.trackEvent(eventName, params);
}

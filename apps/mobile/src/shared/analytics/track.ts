import type { Analytics, AnalyticsEventParams } from '@src/core/ports/analytics';

import type { AppEventMap } from './event-map';

export function track<E extends keyof AppEventMap & string>(
  analytics: Analytics,
  eventName: E,
  ...args: AppEventMap[E] extends undefined ? [] : [params: AppEventMap[E] & AnalyticsEventParams]
): void {
  const [params] = args;
  analytics.trackEvent(eventName, params);
}

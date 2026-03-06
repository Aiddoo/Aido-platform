import type { Analytics } from '@src/core/ports/analytics';
import type { AppEventMap } from './events';

export const track = <E extends keyof AppEventMap>(
  analytics: Analytics,
  eventName: E,
  ...args: AppEventMap[E] extends undefined ? [] : [params: AppEventMap[E]]
): void => {
  analytics.trackEvent(eventName as string, args[0] as Record<string, unknown> | undefined);
};

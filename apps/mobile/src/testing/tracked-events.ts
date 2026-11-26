import type { Analytics } from '@src/core/ports/analytics';
import type { AppEventName } from '@src/shared/analytics/track';

/** 그 이름으로 남긴 분석 이벤트의 값을 남긴 순서대로 돌려준다. 몇 번 남았는지는 길이로 본다 */
export function getTrackedEvents(
  analytics: Pick<jest.Mocked<Analytics>, 'trackEvent'>,
  eventName: AppEventName,
) {
  return analytics.trackEvent.mock.calls
    .filter(([name]) => name === eventName)
    .map(([, params]) => params);
}

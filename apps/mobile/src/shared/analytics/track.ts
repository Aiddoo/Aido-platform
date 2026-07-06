import type { Analytics, AnalyticsEventParams } from '@src/core/ports/analytics';
import type { AppEventMap } from './events';

/**
 * 타입 이벤트 카탈로그(`AppEventMap`) 기반 Analytics 파사드.
 *
 * - `eventName`은 카탈로그의 키로만, payload는 해당 이벤트의 타입으로만 강제된다.
 * - `& AnalyticsEventParams` 교차로 payload가 포트 시그니처에 무캐스트로 할당된다
 *   (모든 이벤트 payload는 객체이므로 교차는 콜사이트 타입을 바꾸지 않음).
 */
export const track = <E extends keyof AppEventMap & string>(
  analytics: Analytics,
  eventName: E,
  ...args: AppEventMap[E] extends undefined ? [] : [params: AppEventMap[E] & AnalyticsEventParams]
): void => {
  const [params] = args;
  analytics.trackEvent(eventName, params);
};

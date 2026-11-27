import type { Analytics } from '@src/core/ports/analytics';

import type { AppEventMap } from './event-map';

export type AppEventName = keyof AppEventMap & string;

/** 선언한 키만 받는다. 선언 밖 키는 객체 리터럴 검사에서 typecheck가 실패한다 */
export type AppEventArguments<E extends AppEventName> = AppEventMap[E] extends undefined
  ? []
  : [params: AppEventMap[E]];

export function track<E extends AppEventName>(
  analytics: Analytics,
  eventName: E,
  ...eventParams: AppEventArguments<E>
): void {
  const [params] = eventParams;
  analytics.trackEvent(eventName, params);
}

import type { GaReservedPurchaseEventName } from '@src/core/observability/telemetry-keys';

import type { FeatureKey } from './feature-key';

export type LocalDateChangeTrigger = 'midnight_timer' | 'foreground' | 'calendar_change';

/** `declare module`이 이 선언을 가리키므로 export를 유지한다 @public */
export interface AppEventMap {
  /** payload에 검색어·본문·계정 ID를 넣지 않는다 */
  // oxlint-disable-next-line aido/analytics-event-catalog -- 1.15.2 전환 #1400
  feature_action_success: { campaign_id: string; feature: FeatureKey };
  /** 진단용 날짜 값은 Sentry breadcrumb에만 남긴다 */
  local_day_changed: { trigger: LocalDateChangeTrigger };
  /** 오프라인 배너가 뜨는 전환(오프라인 구간)마다 한 번 */
  offline_banner_shown: undefined;
}

/** 앱 이벤트가 GA 예약 구매 이벤트 이름을 쓰면 컴파일 오류가 난다 @public */
export type AssertNoReservedPurchaseEvent<Name extends never> = Name;
/** @public */
export type AppReservedPurchaseEventGuard = AssertNoReservedPurchaseEvent<
  Extract<keyof AppEventMap, GaReservedPurchaseEventName>
>;

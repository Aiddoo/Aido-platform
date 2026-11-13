import type { GaReservedPurchaseEventName } from '@src/core/observability/telemetry-keys';
import type { ScreenName } from '@src/shared/utils/to-screen-name';

import type { CampaignId, FeatureKey } from './feature-key';

export type LocalDateChangeTrigger = 'midnight_timer' | 'foreground' | 'calendar_change';

/** 화면 보기 스키마(`z.enum`)가 정한 값이라 목록이 닫혀 있다. shared는 기능 스키마를 모르므로 이름만 붙인다 */
type ViewTabValue = string;

/** `declare module`이 이 선언을 가리키므로 export를 유지한다 @public */
export interface AppEventMap {
  /** payload에 검색어·본문·계정 ID를 넣지 않는다 */
  feature_action_success: { campaign_id: CampaignId; feature: FeatureKey };
  /** 진단용 날짜 값은 Sentry breadcrumb에만 남긴다 */
  local_day_changed: { trigger: LocalDateChangeTrigger };
  /** 오프라인 배너가 뜨는 전환(오프라인 구간)마다 한 번 */
  offline_banner_shown: undefined;
  /** URL로 바뀌는 탭(`ViewTabs`)을 다른 탭으로 바꿨을 때. 같은 탭을 다시 누르면 보내지 않는다 */
  view_tab_changed: { screen_name: ScreenName; view: ViewTabValue };
  /** 조회 오류 화면의 다시 시도. 어느 화면에서 실패가 잦은지 본다 */
  error_fallback_retry_tapped: { screen_name: ScreenName };
}

/** 앱 이벤트가 GA 예약 구매 이벤트 이름을 쓰면 컴파일 오류가 난다 @public */
export type AssertNoReservedPurchaseEvent<Name extends never> = Name;
/** @public */
export type AppReservedPurchaseEventGuard = AssertNoReservedPurchaseEvent<
  Extract<keyof AppEventMap, GaReservedPurchaseEventName>
>;

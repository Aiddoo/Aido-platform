import type { GaReservedPurchaseEventName } from '@src/core/observability/telemetry-keys';

import type { FeatureKey } from './feature-key';

export type LocalDateChangeTrigger = 'midnight_timer' | 'foreground' | 'calendar_change';

/**
 * feature가 자기 이벤트를 `constants/{feature}.events.ts`에서 `declare module`로 채운다.
 * 아래는 특정 feature에 속하지 않는 앱 공통 이벤트다.
 * `declare module`이 이 선언을 가리키므로 export를 유지한다.
 * @public
 */
export interface AppEventMap {
  /**
   * 기능 발견·활성화 지표. 검색어, 메모/Todo 본문, 계정 ID는 payload에 넣지 않는다.
   * 캠페인·기능·저카디널리티 상태만 수집해 노출 → CTA → 실제 성공 퍼널을 계산한다.
   */
  feature_action_success: { campaign_id: string; feature: FeatureKey };
  /** 앱 생명주기 기반 제품 지표. 진단용 날짜 값은 Sentry breadcrumb에만 남긴다 */
  local_day_changed: { trigger: LocalDateChangeTrigger };
  /** 오프라인 배너가 뜨는 전환(오프라인 구간)마다 한 번 */
  offline_banner_shown: undefined;
}

/**
 * 앱 이벤트가 GA 예약 구매 이벤트 이름을 쓰면 여기서 컴파일 오류가 난다
 * @public
 */
export type AssertNoReservedPurchaseEvent<Name extends never> = Name;
/** @public */
export type AppReservedPurchaseEventGuard = AssertNoReservedPurchaseEvent<
  Extract<keyof AppEventMap, GaReservedPurchaseEventName>
>;

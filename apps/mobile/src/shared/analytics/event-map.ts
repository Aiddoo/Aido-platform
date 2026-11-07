import type { GaReservedPurchaseEventName } from '@src/core/observability/telemetry-keys';
import type { LegacyEventMap } from '@src/shared/observability/telemetry-keys';

/**
 * feature가 자기 이벤트를 `constants/{feature}.events.ts`에서 `declare module`로 채운다.
 * shared는 어느 feature의 이벤트도 알지 못한다. `declare module`이 이 선언을 가리키므로 export를 유지한다.
 * @public
 */
export interface AppEventMap {}

/** `useTrack`·`track`이 받는 모든 이벤트. 옮기는 중에는 옛 카탈로그와 함께 본다 */
export type TrackedEventMap = LegacyEventMap & AppEventMap;

/**
 * 앱 이벤트가 GA 예약 구매 이벤트 이름을 쓰면 여기서 컴파일 오류가 난다
 * @public
 */
export type AssertNoReservedPurchaseEvent<Name extends never> = Name;
/** @public */
export type AppReservedPurchaseEventGuard = AssertNoReservedPurchaseEvent<
  Extract<keyof TrackedEventMap, GaReservedPurchaseEventName>
>;

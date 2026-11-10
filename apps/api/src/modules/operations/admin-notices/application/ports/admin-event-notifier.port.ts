import type { SubscriptionAlertInput } from "../read-models/subscription-alert.read-model.js";
import type { UserRegisteredEventPayload } from "../read-models/user-registered.read-model.js";

/**
 * 다른 Context가 운영 흐름과 격리해 관리자 알림을 요청하는 문. 요청은 기다리지 않고(fire-and-forget)
 * 실패해도 호출한 업무를 되돌리지 않는다.
 */
export abstract class AdminEventNotifierPort {
  abstract notifyUserRegistered(payload: UserRegisteredEventPayload): void;
  abstract notifySubscriptionEvent(payload: SubscriptionAlertInput): void;
}

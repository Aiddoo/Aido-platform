import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SubscriptionEventPayloadReadModel } from "./subscription-event-payload.read-model.js";

/** 스토어 구독 이벤트 하나를 반영한 결과. 커밋 뒤 캐시 정리·운영 알림·완료 로그가 이 값으로 이어진다. */
export type SubscriptionEventOutcomeReadModel =
  | {
      readonly status: "applied";
      /** 이벤트의 사용자. 이전이면 넘겨받은 사용자다. */
      readonly userId: UserId;
      /** 프리미엄을 다시 계산해 캐시를 비울 사용자 */
      readonly affectedUserIds: readonly UserId[];
      readonly payload: SubscriptionEventPayloadReadModel;
    }
  /** 처리 원장이 이미 반영한 이벤트라고 막았다. */
  | { readonly status: "duplicate"; readonly userId: UserId }
  /** 지난 기간의 늦은 이벤트처럼 바꿀 것이 없었다. */
  | { readonly status: "unchanged"; readonly userId: UserId };

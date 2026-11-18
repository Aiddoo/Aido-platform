import type { SubscriptionStatus } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import { resolveCancellationUserStatus } from "./cancellation-user-status.domain-service.js";
import type { ProviderEventId } from "./provider-event-id.vo.js";
import type { StoreSubscriptionChainEvent } from "./store-subscription.event.js";
import { periodTypeAfter } from "./subscription-lifecycle.domain-service.js";
import type { Subscription } from "./subscription.aggregate.js";

type Instant = Temporal.Instant;

/** 있는 체인 행을 바꾸는 이벤트. 구매(행 생성)·결제 문제(유예 기록)·처리 안 함은 따로 다룬다. */
export type SubscriptionChangeEvent = Exclude<
  StoreSubscriptionChainEvent,
  { kind: "STARTED" | "BILLING_ISSUE" | "IGNORED" }
>;

/** 스토어 구독도 보상 기간도 없을 때 User에 남길 구독 상태. 만료 시각을 생략하면 저장값을 둔다. */
export interface SubscriptionStatusFallback {
  readonly subscriptionStatus: SubscriptionStatus;
  readonly subscriptionExpiresAt?: Instant | null;
}

export interface SubscriptionChange {
  readonly fallback: SubscriptionStatusFallback;
  /** 운영 알림과 보상 기간 판단에 쓸 이용 종료 시각. 비우면 이벤트·행의 값이다. */
  readonly reportedExpiresAt?: Instant;
}

const FREE_FALLBACK: SubscriptionStatusFallback = {
  subscriptionStatus: "FREE",
  subscriptionExpiresAt: null,
};

/**
 * 이벤트 종류에 맞는 체인 전이를 적용하고 그 결과를 돌려준다. 같은 값의 재전송이나 지난 기간의 늦은 이벤트로
 * 바뀐 것이 없으면 null이다. 갱신의 새 만료 시각은 호출자가 먼저 확인해 넘긴다.
 */
export function applySubscriptionChange(params: {
  readonly subscription: Subscription;
  readonly event: SubscriptionChangeEvent;
  readonly renewalExpiresAt: Instant | undefined;
  readonly eventId: ProviderEventId | undefined;
  readonly now: Instant;
}): SubscriptionChange | null {
  const { subscription, event, eventId, now } = params;
  const expiresAt = event.periodEndsAt;
  const eventFields = {
    now,
    ...(eventId != null && { eventId }),
    ...(expiresAt != null && { expiresAt }),
  };
  const activeFallback: SubscriptionStatusFallback = {
    subscriptionStatus: "ACTIVE",
    ...(expiresAt != null && { subscriptionExpiresAt: expiresAt }),
  };
  return match(event)
    .returnType<SubscriptionChange | null>()
    .with({ kind: "RENEWED" }, (renewed) => renew({ ...params, event: renewed }))
    .with({ kind: "CANCELLED" }, { kind: "REFUNDED" }, (cancelled) =>
      cancel({ ...params, event: cancelled }),
    )
    .with({ kind: "UNCANCELLED" }, () =>
      subscription.uncancel(eventFields) ? { fallback: activeFallback } : null,
    )
    .with({ kind: "EXPIRED" }, () =>
      subscription.expire({
        expirationAt: expiresAt ?? null,
        now,
        ...(eventId != null && { eventId }),
      })
        ? { fallback: FREE_FALLBACK }
        : null,
    )
    .with({ kind: "PRODUCT_CHANGE_SCHEDULED" }, (changed) =>
      subscription.reserveProductChange({
        ...eventFields,
        ...(changed.newProductId != null && { newProductId: changed.newProductId }),
      })
        ? { fallback: activeFallback }
        : null,
    )
    .with({ kind: "EXTENDED" }, () =>
      subscription.extend(eventFields) ? { fallback: activeFallback } : null,
    )
    .exhaustive();
}

function renew(params: {
  readonly subscription: Subscription;
  readonly event: Extract<SubscriptionChangeEvent, { kind: "RENEWED" }>;
  readonly renewalExpiresAt: Instant | undefined;
  readonly eventId: ProviderEventId | undefined;
  readonly now: Instant;
}): SubscriptionChange | null {
  const { subscription, event, renewalExpiresAt, eventId, now } = params;
  const periodType = periodTypeAfter(event);
  if (
    renewalExpiresAt == null ||
    !subscription.renew({
      expiresAt: renewalExpiresAt,
      now,
      ...(eventId != null && { eventId }),
      ...(periodType != null && { periodType }),
      productId: event.productId,
    })
  ) {
    return null;
  }
  return {
    fallback: { subscriptionStatus: "ACTIVE", subscriptionExpiresAt: renewalExpiresAt },
    reportedExpiresAt: renewalExpiresAt,
  };
}

// 해지는 이벤트에 만료 시각이 없어도 행이 아는 이용 종료 시각을 알리고 보상 기간 판단에 쓴다
function cancel(params: {
  readonly subscription: Subscription;
  readonly event: Extract<SubscriptionChangeEvent, { kind: "CANCELLED" | "REFUNDED" }>;
  readonly eventId: ProviderEventId | undefined;
  readonly now: Instant;
}): SubscriptionChange | null {
  const { subscription, event, eventId, now } = params;
  const refunded = event.kind === "REFUNDED";
  const cancellationExpiresAt = event.periodEndsAt ?? subscription.expiresAt;
  if (
    !subscription.cancel({
      refunded,
      now,
      ...(eventId != null && { eventId }),
      eventPeriodType: event.periodKind,
      ...(event.periodEndsAt != null && { eventExpiresAt: event.periodEndsAt }),
    })
  ) {
    return null;
  }
  return {
    fallback: refunded
      ? FREE_FALLBACK
      : {
          subscriptionStatus: resolveCancellationUserStatus(cancellationExpiresAt, now),
          subscriptionExpiresAt: cancellationExpiresAt,
        },
    reportedExpiresAt: cancellationExpiresAt,
  };
}
